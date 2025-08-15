<?php
declare(strict_types=1);

namespace App\Command;

use App\Application\Ports\Messaging\{CloudEvent, EventPublisher};
use Doctrine\ORM\EntityManagerInterface;
use Ramsey\Uuid\Uuid;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

use App\Domain\Distribucion\Entity\{Orden, Chofer, Pyme, CentroDistribucion, OrdenProducto, Producto};

#[AsCommand(name: 'app:seed-events', description: 'Publica eventos de prueba en Redis usando datos reales de BD')]
final class SeedEventsCommand extends Command
{
    public function __construct(
        private EventPublisher $publisher,
        private EntityManagerInterface $em
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('n', null, InputOption::VALUE_REQUIRED, 'Cantidad de eventos', '30')
            ->addOption('stream', null, InputOption::VALUE_REQUIRED, 'Stream destino', null)
            ->addOption('orders-per-event', 'k', InputOption::VALUE_REQUIRED, 'Órdenes por evento', '5')
            ->addOption('fallback-random', null, InputOption::VALUE_NONE, 'Si no hay datos suficientes, completa aleatorio')
            ->addOption('from-file', null, InputOption::VALUE_REQUIRED, 'Plantilla JSON opcional', null);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $n       = (int) $input->getOption('n');
        $stream  = $input->getOption('stream') ?? ($_ENV['REDIS_STREAM'] ?? 'distribucion.bloques');
        $k       = max(1, (int) $input->getOption('orders-per-event'));
        $fallbackRandom = (bool) $input->getOption('fallback-random');

        $base = null;
        if ($file = $input->getOption('from-file')) {
            $base = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        }

        for ($i = 0; $i < $n; $i++) {
            $orders = $this->sampleOrders($k);                     // ← toma órdenes reales (con joins)
            if (empty($orders) && !$fallbackRandom) {
                $output->writeln('<comment>Sin órdenes en BD. Use --fallback-random para completar aleatorio.</comment>');
                break;
            }

            $event = $this->buildEventFromDb($orders, $base);
            $this->publisher->publish($stream, $event);
        }

        $output->writeln(sprintf('<info>OK: publicados %d eventos en "%s".</info>', $n, $stream));
        return Command::SUCCESS;
    }

    /** @return array<int, Orden> */
    private function sampleOrders(int $n): array
    {
        // Toma hasta 100 más recientes y luego muestrea aleatorio k
        $ids = $this->em->createQueryBuilder()
            ->select('o.id')
            ->from(Orden::class, 'o')
            ->orderBy('o.fechaDespacho', 'DESC')
            ->setMaxResults(100)
            ->getQuery()->getSingleColumnResult();

        if (!$ids) return [];

        shuffle($ids);
        $ids = array_slice($ids, 0, $n);

        return $this->em->createQueryBuilder()
            ->select('o, py, oc, dc, ch, l, pr')
            ->from(Orden::class, 'o')
            ->leftJoin('o.pyme', 'py')
            ->leftJoin('o.origenCd', 'oc')
            ->leftJoin('o.destinoCd', 'dc')
            ->leftJoin('o.chofer', 'ch')
            ->leftJoin('o.lineas', 'l')
            ->leftJoin('l.producto', 'pr')
            ->where('o.id IN (:ids)')
            ->setParameter('ids', $ids)
            ->getQuery()->getResult();
    }

    private function buildEventFromDb(array $orders, ?array $base): CloudEvent
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        // Elegir chofer: el más frecuente entre las órdenes; si todos null, cualquiera de la tabla
        $chofer = $this->chooseChofer($orders) ?? $this->anyChofer();

        // Payload v1.2 (contrato “data”)
        $data = $base['data'] ?? [];
        $data['bloque'] = [
            'id'     => 'blk-' . substr(Uuid::uuid4()->toString(), 0, 12),
            'fecha'  => $now->format(DATE_ATOM),
            'chofer' => $chofer ? [
                'id' => (string) $chofer->getId(),        // UUID
                'nombre' => $chofer->getNombre(),
            ] : null,
        ];

        $data['ordenes'] = array_values(array_map(
            fn(Orden $o) => $this->mapOrdenToContract($o),
            $orders
        ));

        return new CloudEvent(
            type: 'logistrack.distribucion.BloqueConsolidadoListo.v2',    // ← tipo nuevo
            source: $_ENV['SOURCE_URI'] ?? 'symfony://distribucion',
            id: Uuid::uuid4()->toString(),
            time: $now,
            dataSchema: $_ENV['CONTRACT_DATA_SCHEMA']
                ?? 'https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.2/schema.json',
            subject: 'bloque:' . $data['bloque']['id'],
            data: $data,
            traceparent: $this->genTraceparent()
        );
    }

    private function chooseChofer(array $orders): ?Chofer
    {
        $counts = []; $map = [];
        foreach ($orders as $o) {
            /** @var ?Chofer $c */
            $c = $o->getChofer();
            if ($c) {
                $key = (string) $c->getId();
                $counts[$key] = ($counts[$key] ?? 0) + 1;
                $map[$key] = $c;
            }
        }
        if (!$counts) return null;
        arsort($counts);
        $firstKey = array_key_first($counts);
        return $map[$firstKey] ?? null;
    }

    private function anyChofer(): ?Chofer
    {
        return $this->em->getRepository(Chofer::class)->findOneBy([], ['createdAt' => 'DESC'])
            ?? $this->em->getRepository(Chofer::class)->findOneBy([]);
    }

    /** Mapea Orden (con relaciones) → contrato v1.2 */
    private function mapOrdenToContract(Orden $o): array
    {
        $py  = $o->getPyme();                  /** @var Pyme $py */
        $oc  = $o->getOrigenCd();              /** @var CentroDistribucion $oc */
        $dc  = $o->getDestinoCd();             /** @var CentroDistribucion $dc */

        $productos = [];
        foreach ($o->getLineas() as $l) {      /** @var OrdenProducto $l */
            $p = $l->getProducto();            /** @var Producto $p */
            $productos[] = [
                'producto' => [
                    'sku'    => $p->getSku(),
                    'nombre' => $p->getNombre(),
                ],
                'qty'     => $l->getQty(),
                'peso'    => (float) $l->getPeso(),
                'volumen' => (float) $l->getVolumen(),
            ];
        }

        return [
            'id'                  => (string) $o->getId(),
            'pyme'                => ['id' => (string) $py->getId(), 'nombre' => $py->getNombre()],
            'origen_cd'           => ['id' => (string) $oc->getId(), 'nombre' => $oc->getNombre()],
            'destino_cd'          => ['id' => (string) $dc->getId(), 'nombre' => $dc->getNombre()],
            'fecha_despacho'      => $o->getFechaDespacho()->format(DATE_ATOM),
            'estado_preparacion'  => (string) $o->getEstadoPreparacion()->value, // "PEN" | "COM"
            'peso_total'          => (float) $o->getPesoTotal(),
            'volumen_total'       => (float) $o->getVolumenTotal(),
            'productos'           => $productos ?: $this->fallbackLinea(), // por si alguna orden no tiene líneas
        ];
    }

    private function fallbackLinea(): array
    {
        return [[
            'producto' => ['sku' => 'SKU-FAKE', 'nombre' => 'Temporal'],
            'qty' => 1, 'peso' => 0.1, 'volumen' => 0.001
        ]];
    }

    private function genTraceparent(): string
    {
        $traceId  = bin2hex(random_bytes(16)); // 32 hex
        $parentId = bin2hex(random_bytes(8));  // 16 hex
        return sprintf('00-%s-%s-01', $traceId, $parentId);
    }
}

<?php
declare(strict_types=1);

namespace App\Command;

use App\Application\Ports\Messaging\{CloudEvent, EventPublisher};
use Ramsey\Uuid\Uuid;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:seed-events', description: 'Publica eventos de prueba en Redis')]
final class SeedEventsCommand extends Command
{
    public function __construct(private EventPublisher $publisher)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('n', null, InputOption::VALUE_REQUIRED, 'Cantidad de eventos', '30')
            ->addOption('stream', null, InputOption::VALUE_REQUIRED, 'Stream destino', null)
            ->addOption('from-file', null, InputOption::VALUE_REQUIRED, 'Ruta a JSON base (ok-full.json opcional)', null);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $n      = (int) $input->getOption('n');
        $stream = $input->getOption('stream') ?? ($_ENV['REDIS_STREAM'] ?? 'distribucion.bloques');
        $base   = null;

        if ($file = $input->getOption('from-file')) {
            $base = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        }

        for ($i = 0; $i < $n; $i++) {
            $event = $this->buildEvent($base, $i);
            $this->publisher->publish($stream, $event);
        }

        $output->writeln(sprintf('<info>OK: publicados %d eventos en "%s".</info>', $n, $stream));
        return Command::SUCCESS;
    }

    private function buildEvent(?array $base, int $i): CloudEvent
    {
        $now  = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $data = $base['data'] ?? null;

        if (!$data) {
            // payload mínimo válido según el contrato
            $data = [
                'bloque_id'       => 'b-' . (1000 + $i),
                'fecha_despacho'  => $now->format(DATE_ATOM),
                'chofer'          => $this->randomChofer(),
                'ordenes'         => [$this->randomOrden($i, 0)],
            ];
        } else {
            // muta el ejemplo base
            $data['bloque_id']      = 'b-' . (1000 + $i);
            $data['fecha_despacho'] = $now->format(DATE_ATOM);
            $data['chofer']         = $this->randomChofer();
            if (!empty($data['ordenes'])) {
                foreach ($data['ordenes'] as $k => &$o) {
                    $o['id'] = "o-{$i}-{$k}";
                }
            } else {
                $data['ordenes'] = [$this->randomOrden($i, 0)];
            }
        }

        return new CloudEvent(
            type: 'logistrack.distribucion.BloqueConsolidadoListo.v1',
            source: $_ENV['SOURCE_URI'] ?? 'symfony://distribucion',
            id: Uuid::uuid4()->toString(),
            time: $now,
            dataSchema: $_ENV['CONTRACT_DATA_SCHEMA']
                ?? 'https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.0/schema.json',
            subject: 'bloque:' . $data['bloque_id'],
            data: $data,
            traceparent: $this->genTraceparent() // o null si prefieres omitirlo en toArray()
        );
    }

    private function randomChofer(): array
    {
        $list = [
            ['id' => 'c-10', 'nombre' => 'María López'],
            ['id' => 'c-11', 'nombre' => 'Juan Pérez'],
            ['id' => 'c-12', 'nombre' => 'Ana Gómez'],
        ];
        return $list[array_rand($list)];
    }

    private function randomOrden(int $i, int $j): array
    {
        $sku    = 'SKU-' . random_int(1, 9);
        $peso   = round(random_int(50, 500) / 100, 2);
        $vol    = round(random_int(1, 20) / 100, 3);
        $cds    = ['a', 'b', 'c'];
        $cdA    = 'cd-' . $cds[array_rand($cds)];
        $cdB    = 'cd-' . $cds[array_rand($cds)];
        return [
            'id'           => "o-{$i}-{$j}",
            'pyme_id'      => 'p-' . random_int(1, 5),
            'origen_cd_id' => $cdA,
            'destino_cd_id'=> $cdB,
            'productos'    => [[ 'sku' => $sku, 'qty' => random_int(1, 3), 'peso' => $peso, 'volumen' => $vol ]],
        ];
    }

    private function genTraceparent(): string
    {
        $traceId  = bin2hex(random_bytes(16)); // 32 hex
        $parentId = bin2hex(random_bytes(8));  // 16 hex
        return sprintf('00-%s-%s-01', $traceId, $parentId);
    }
}

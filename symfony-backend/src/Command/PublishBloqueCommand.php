<?php
declare(strict_types=1);

namespace App\Command;

use App\Application\Ports\Messaging\{CloudEvent, EventPublisher};
use Ramsey\Uuid\Uuid;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:publish-bloque')]
final class PublishBloqueCommand extends Command
{
    public function __construct(private EventPublisher $publisher, private string $schema = '')
    {
        parent::__construct();
        $this->schema = $_ENV['CONTRACT_DATA_SCHEMA'] ?? '';
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $dto = [
            'bloque_id' => 'b-1001',
            'fecha_despacho' => (new \DateTimeImmutable())->format(DATE_ATOM),
            'chofer' => ['id' => 'c-10', 'nombre' => 'María López'],
            'ordenes' => [[
                'id' => 'o-1', 'pyme_id' => 'p-1', 'origen_cd_id' => 'cd-a', 'destino_cd_id' => 'cd-b',
                'productos' => [['sku' => 'SKU-1','qty' => 2,'peso' => 1.2,'volumen' => 0.01]]
            ]]
        ];

        $event = new CloudEvent(
            type: 'logistrack.distribucion.BloqueConsolidadoListo.v1',
            source: $_ENV['SOURCE_URI'] ?? 'symfony://distribucion',
            id: Uuid::uuid4()->toString(),
            time: new \DateTimeImmutable(),
            dataSchema: $this->schema,
            subject: 'bloque:'.$dto['bloque_id'],
            data: $dto
        );

        $this->publisher->publish($_ENV['REDIS_STREAM'] ?? 'distribucion.bloques', $event);

        $output->writeln('<info>Evento publicado.</info>');
        return Command::SUCCESS;
    }
}

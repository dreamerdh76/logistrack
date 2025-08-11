<?php
declare(strict_types=1);

namespace App\Infrastructure\Messaging\Redis;

use App\Application\Ports\Messaging\{EventPublisher, CloudEvent, PublishException, PublishOptions};
use Predis\Client as PredisClient;
use Psr\Log\LoggerInterface;

final class RedisEventPublisher implements EventPublisher
{
    public function __construct(
        private PredisClient $redis,
        private string $stream,
        private string $dlqStream,
        private LoggerInterface $logger
    ) {}

    public function publish(string $channel, CloudEvent $event, ?PublishOptions $options = null): void
    {
        $stream  = $channel ?: $this->stream;
        $payload = null;

        try {
            $payload = json_encode($event->toArray(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            // XADD <stream> * data <json>
            $this->redis->executeRaw(['XADD', (string)$stream, '*', 'data', (string)$payload]);

            $this->logger->info('Evento publicado en Redis', [
                'stream' => $stream,
                'type'   => $event->type,
                'subject'=> $event->subject,
                'id'     => $event->id,
            ]);
        } catch (\Throwable $e) {
            try {
                $payload = $payload ?? json_encode(
                    ['_fallback' => true, 'event' => $event->toArray()],
                    JSON_UNESCAPED_UNICODE
                );

                $this->redis->executeRaw([
                    'XADD', (string)$this->dlqStream, '*',
                    'data',  (string)$payload,
                    'error', (string)$e->getMessage(),
                ]);

                $this->logger->error('Fallo publicando; enviado a DLQ', [
                    'stream' => $stream,
                    'dlq'    => $this->dlqStream,
                    'error'  => $e->getMessage(),
                ]);
            } catch (\Throwable $e2) {
                $this->logger->critical('Fallo también DLQ', [
                    'stream' => $stream,
                    'dlq'    => $this->dlqStream,
                    'error'  => $e2->getMessage(),
                ]);
            }

            throw new PublishException($e->getMessage(), previous: $e);
        }
    }
}

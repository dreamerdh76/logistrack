<?php
declare(strict_types=1);

namespace App\Infrastructure\Messaging\Redis;

use Predis\Client as PredisClient;

final class PredisFactory
{

    public static function fromDsn(
        string $dsn,
        ?string $prefix = null,
        float $timeout = 1.5,
        float $readWriteTimeout = 1.5,
        bool $pingOnBoot = true
    ): PredisClient {
        $options = [
            // Prefijo para claves (útil para separar ambientes)
            'prefix' => $prefix ? rtrim($prefix, ':') . ':' : null,
            // Parámetros de bajo nivel del socket
            'parameters' => [
                'timeout'            => $timeout,
                'read_write_timeout' => $readWriteTimeout,
                // 'persistent' => true, // si quieres conexión persistente
            ],
        ];

        // Limpia nulls
        $options = array_filter($options, static fn($v) => $v !== null);

        $client = new PredisClient($dsn, $options);

        if ($pingOnBoot) {
            // Valida conectividad temprana (fail-fast)
            $client->ping();
        }

        return $client;
    }
}

<?php
declare(strict_types=1);

namespace App\Application\Ports\Messaging;

final readonly class PublishOptions
{
    public function __construct(
        public ?string $partitionKey = null,
        public ?int $ttlSeconds = null
    ) {}
}

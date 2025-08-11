<?php
declare(strict_types=1);

namespace App\Application\Ports\Messaging;

interface EventPublisher
{
    /**
     * Publica un CloudEvent en el canal/stream indicado.
     *
     * @throws PublishException si la publicación falla.
     */
    public function publish(string $channel, CloudEvent $event, ?PublishOptions $options = null): void;
}

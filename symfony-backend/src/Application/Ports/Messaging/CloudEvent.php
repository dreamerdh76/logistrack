<?php
declare(strict_types=1);

namespace App\Application\Ports\Messaging;

final readonly class CloudEvent
{
    public function __construct(
        public string $type,
        public string $source,
        public string $id,
        public \DateTimeInterface $time,
        public string $dataSchema,
        public string $subject,
        public array $data,
        public ?string $traceparent = null,
        public string $specVersion = '1.0',
        public string $dataContentType = 'application/json',
    ) {}

    public function toArray(): array
    {
        $arr = [
            'specversion'     => $this->specVersion,
            'type'            => $this->type,
            'source'          => $this->source,
            'id'              => $this->id,
            'time'            => $this->time->format(DATE_ATOM),
            'datacontenttype' => $this->dataContentType,
            'dataschema'      => $this->dataSchema,
            'subject'         => $this->subject,
            'traceparent'     => $this->traceparent,
            'data'            => $this->data,
        ];
        return array_filter($arr, static fn($v) => $v !== null);
    }
}

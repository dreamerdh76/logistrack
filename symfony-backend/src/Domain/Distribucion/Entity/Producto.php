<?php
// src/Domain/Distribucion/Entity/Producto.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;
use Ramsey\Uuid\UuidInterface;
use Ramsey\Uuid\Doctrine\UuidGenerator;

#[ORM\Entity]
#[ORM\Table(name:"distribucion_producto")]
#[ORM\UniqueConstraint(name:"uniq_producto_sku", columns:["sku"])]
class Producto {
    #[ORM\Id]
    #[ORM\Column(type:"uuid")]
    #[ORM\GeneratedValue(strategy:"CUSTOM")]
    #[ORM\CustomIdGenerator(class: UuidGenerator::class)]
    private UuidInterface $id;

    #[ORM\Column(length:64)]
    private string $sku;

    #[ORM\Column(length:200)]
    private string $nombre;

    #[ORM\Column(type:"boolean")]
    private bool $activo = true;

    public function __construct(string $sku, string $nombre){ $this->sku=$sku; $this->nombre=$nombre; }
    public function getId(): UuidInterface { return $this->id; }
    public function getSku(): string { return $this->sku; }
    public function getNombre(): string { return $this->nombre; }
    public function isActivo(): bool { return $this->activo; }
}

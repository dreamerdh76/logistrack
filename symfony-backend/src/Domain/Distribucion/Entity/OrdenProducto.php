<?php
// src/Domain/Distribucion/Entity/OrdenProducto.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:"distribucion_ordenproducto")]
#[ORM\UniqueConstraint(name:"uniq_orden_producto", columns:["orden_id","producto_id"])]
#[ORM\Index(name:"idx_op_orden", columns:["orden_id"])]
#[ORM\Index(name:"idx_op_producto", columns:["producto_id"])]
class OrdenProducto {
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Orden::class, inversedBy:"lineas")]
    #[ORM\JoinColumn(name:"orden_id", referencedColumnName:"id", nullable:false, onDelete:"CASCADE")]
    private Orden $orden;

    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Producto::class)]
    #[ORM\JoinColumn(name:"producto_id", referencedColumnName:"id", nullable:false, onDelete:"RESTRICT")]
    private Producto $producto;

    #[ORM\Column(type:"integer")]
    private int $qty;

    #[ORM\Column(type:"decimal", precision:12, scale:3)]
    private string $peso = '0';

    #[ORM\Column(type:"decimal", precision:12, scale:6)]
    private string $volumen = '0';

    public function __construct(Orden $orden, Producto $producto, int $qty){ $this->orden=$orden; $this->producto=$producto; $this->qty=$qty; }
    public function getOrden(): Orden { return $this->orden; }
    public function getProducto(): Producto { return $this->producto; }
    public function getQty(): int { return $this->qty; }
    public function getPeso(): string { return $this->peso; }
    public function getVolumen(): string { return $this->volumen; }
}

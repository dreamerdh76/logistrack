<?php
// src/Domain/Distribucion/Entity/BloqueOrden.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:"distribucion_bloqueorden")]
#[ORM\UniqueConstraint(name:"uniq_bloque_orden", columns:["bloque_id","orden_id"])]
class BloqueOrden {
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Bloque::class, inversedBy:"bloqueOrdenes")]
    #[ORM\JoinColumn(name:"bloque_id", referencedColumnName:"id", nullable:false, onDelete:"CASCADE")]
    private Bloque $bloque;

    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Orden::class)]
    #[ORM\JoinColumn(name:"orden_id", referencedColumnName:"id", nullable:false, onDelete:"RESTRICT")]
    private Orden $orden;

    public function __construct(Bloque $bloque, Orden $orden){ $this->bloque=$bloque; $this->orden=$orden; }
    public function getBloque(): Bloque { return $this->bloque; }
    public function getOrden(): Orden { return $this->orden; }
}

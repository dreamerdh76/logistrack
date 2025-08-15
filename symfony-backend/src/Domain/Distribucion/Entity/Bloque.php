<?php
// src/Domain/Distribucion/Entity/Bloque.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;
use App\Domain\Distribucion\Enum\EstadoCompletitudBloque;
use App\Domain\Shared\Timestampable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name:"distribucion_bloque")]
#[ORM\Index(name:"idx_bloque_fecha", columns:["fecha"])]
#[ORM\Index(name:"idx_bloque_chofer_estado", columns:["chofer_id","estado_completitud"])]
class Bloque {
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(length:64)]
    private string $id;

    #[ORM\Column(type:"datetime_immutable")]
    private \DateTimeImmutable $fecha;

    #[ORM\ManyToOne(targetEntity: Chofer::class, inversedBy:"bloques")]
    #[ORM\JoinColumn(name:"chofer_id", referencedColumnName:"id", nullable:false, onDelete:"RESTRICT")]
    private Chofer $chofer;

    #[ORM\Column(name:"chofer_nombre", length:200)]
    private string $choferNombre;

    #[ORM\Column(name:"total_ordenes", type:"integer")]
    private int $totalOrdenes = 0;

    #[ORM\Column(name:"estado_completitud", type:"string", enumType: EstadoCompletitudBloque::class, length:3)]
    private EstadoCompletitudBloque $estadoCompletitud = EstadoCompletitudBloque::INC;

    #[ORM\OneToMany(mappedBy:"bloque", targetEntity: BloqueOrden::class, cascade:["persist"], orphanRemoval:true)]
    private Collection $bloqueOrdenes;

    public function __construct(string $id, \DateTimeImmutable $fecha, Chofer $chofer, string $choferNombre){
        $this->id=$id; $this->fecha=$fecha; $this->chofer=$chofer; $this->choferNombre=$choferNombre;
        $this->bloqueOrdenes=new ArrayCollection();
    }
    public function getId(): string { return $this->id; }
    public function getFecha(): \DateTimeImmutable { return $this->fecha; }
    public function getChofer(): Chofer { return $this->chofer; }
    public function getChoferNombre(): string { return $this->choferNombre; }
    public function getTotalOrdenes(): int { return $this->totalOrdenes; }
    public function getEstadoCompletitud(): EstadoCompletitudBloque { return $this->estadoCompletitud; }
}

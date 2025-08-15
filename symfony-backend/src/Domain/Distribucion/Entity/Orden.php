<?php
// src/Domain/Distribucion/Entity/Orden.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use App\Domain\Distribucion\Enum\EstadoPreparacion;
use App\Domain\Shared\Timestampable;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name:"distribucion_orden")]
#[ORM\Index(name:"idx_pyme_fecha", columns:["pyme_id","fecha_despacho"])]
#[ORM\Index(name:"idx_destino_fecha", columns:["destino_cd_id","fecha_despacho"])]
class Orden {
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(length:64)]
    private string $id;

    #[ORM\ManyToOne(targetEntity: Pyme::class)]
    #[ORM\JoinColumn(name:"pyme_id", referencedColumnName:"id", nullable:false, onDelete:"RESTRICT")]
    private Pyme $pyme;

    #[ORM\ManyToOne(targetEntity: CentroDistribucion::class)]
    #[ORM\JoinColumn(name:"origen_cd_id", referencedColumnName:"id", nullable:false, onDelete:"RESTRICT")]
    private CentroDistribucion $origenCd;

    #[ORM\ManyToOne(targetEntity: CentroDistribucion::class)]
    #[ORM\JoinColumn(name:"destino_cd_id", referencedColumnName:"id", nullable:false, onDelete:"RESTRICT")]
    private CentroDistribucion $destinoCd;

    #[ORM\Column(name:"fecha_despacho", type:"datetime_immutable")]
    private \DateTimeImmutable $fechaDespacho;

    #[ORM\Column(type:"string", enumType: EstadoPreparacion::class, length:3)]
    private EstadoPreparacion $estadoPreparacion;

    #[ORM\Column(name:"peso_total", type:"decimal", precision:12, scale:3)]
    private string $pesoTotal = '0';

    #[ORM\Column(name:"volumen_total", type:"decimal", precision:12, scale:6)]
    private string $volumenTotal = '0';

    #[ORM\ManyToOne(targetEntity: Chofer::class, inversedBy:"ordenes")]
    #[ORM\JoinColumn(name:"chofer_id", referencedColumnName:"id", nullable:true, onDelete:"SET NULL")]
    private ?Chofer $chofer = null;

    #[ORM\OneToMany(mappedBy:"orden", targetEntity: OrdenProducto::class, cascade:["persist"], orphanRemoval:true)]
    private Collection $lineas;

    public function __construct(string $id, Pyme $pyme, CentroDistribucion $origen, CentroDistribucion $destino, \DateTimeImmutable $fecha, EstadoPreparacion $estado){
        $this->id=$id; $this->pyme=$pyme; $this->origenCd=$origen; $this->destinoCd=$destino;
        $this->fechaDespacho=$fecha; $this->estadoPreparacion=$estado; $this->lineas=new ArrayCollection();
    }

    // Getters usados por tu seed:
    public function getId(): string { return $this->id; }
    public function getPyme(): Pyme { return $this->pyme; }
    public function getOrigenCd(): CentroDistribucion { return $this->origenCd; }
    public function getDestinoCd(): CentroDistribucion { return $this->destinoCd; }
    public function getFechaDespacho(): \DateTimeImmutable { return $this->fechaDespacho; }
    public function getEstadoPreparacion(): EstadoPreparacion { return $this->estadoPreparacion; }
    public function getPesoTotal(): string { return $this->pesoTotal; }
    public function getVolumenTotal(): string { return $this->volumenTotal; }
    public function getChofer(): ?Chofer { return $this->chofer; }
    /** @return Collection<int, OrdenProducto> */
    public function getLineas(): Collection { return $this->lineas; }
}

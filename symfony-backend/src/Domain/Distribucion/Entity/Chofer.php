<?php
// src/Domain/Distribucion/Entity/Chofer.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;
use Ramsey\Uuid\UuidInterface;
use Ramsey\Uuid\Doctrine\UuidGenerator;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use App\Domain\Shared\Timestampable;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name:"distribucion_chofer")]
class Chofer {
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type:"uuid")]
    #[ORM\GeneratedValue(strategy:"CUSTOM")]
    #[ORM\CustomIdGenerator(class: UuidGenerator::class)]
    private UuidInterface $id;

    #[ORM\Column(length:200)]
    private string $nombre;

    #[ORM\OneToMany(mappedBy:"chofer", targetEntity: Orden::class)]
    private Collection $ordenes;

    #[ORM\OneToMany(mappedBy:"chofer", targetEntity: Bloque::class)]
    private Collection $bloques;

    public function __construct(string $nombre){ $this->nombre=$nombre; $this->ordenes=new ArrayCollection(); $this->bloques=new ArrayCollection(); }
    public function getId(): UuidInterface { return $this->id; }
    public function getNombre(): string { return $this->nombre; }
    public function setNombre(string $n): void { $this->nombre=$n; }
}

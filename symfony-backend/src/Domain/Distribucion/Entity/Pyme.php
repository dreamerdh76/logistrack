<?php
// src/Domain/Distribucion/Entity/Pyme.php
namespace App\Domain\Distribucion\Entity;

use Doctrine\ORM\Mapping as ORM;
use App\Domain\Shared\Timestampable;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name:"distribucion_pyme")]
class Pyme {
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(length:64)]
    private string $id;

    #[ORM\Column(length:200)]
    private string $nombre;

    public function __construct(string $id, string $nombre){ $this->id=$id; $this->nombre=$nombre; }
    public function getId(): string { return $this->id; }
    public function getNombre(): string { return $this->nombre; }
    public function setNombre(string $n): void { $this->nombre=$n; }
}

<?php
// src/Domain/Shared/Timestampable.php
namespace App\Domain\Shared;
use Doctrine\ORM\Mapping as ORM;

trait Timestampable {
    #[ORM\Column(name:"created_at", type:"datetime_immutable")]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name:"updated_at", type:"datetime_immutable")]
    private \DateTimeImmutable $updatedAt;

    #[ORM\PrePersist] public function _setCreatedAt(): void {
        $this->createdAt = new \DateTimeImmutable('now'); $this->updatedAt = $this->createdAt;
    }
    #[ORM\PreUpdate] public function _setUpdatedAt(): void {
        $this->updatedAt = new \DateTimeImmutable('now');
    }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
}

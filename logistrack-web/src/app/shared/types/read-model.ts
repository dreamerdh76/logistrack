// shared/types/read-model.ts
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// --- minis ---
export interface PymeMini { id: string; nombre: string; }
export interface CentroMini { id: string; nombre: string; }
export interface ChoferMini { id: string; nombre: string; }
export interface ProductoMini { sku: string; nombre: string; }

// --- enums (códigos que vienen del back) ---
export type EstadoPrep    = 'PEN' | 'COM';
export type EstadoBloque  = 'INC' | 'COM';
export type EstadoDistrib = 'PEN' | 'ENT' | 'REJ';

// --- orden / líneas ---
export interface OrdenProducto {
  producto: ProductoMini;          // <- viene anidado
  qty: number;
  peso: number;
  volumen: number;
}

export interface Orden {
  id: string;
  pyme: PymeMini;
  origen_cd: CentroMini;
  destino_cd: CentroMini;
  fecha_despacho: string;          // ISO string
  estado_preparacion: EstadoPrep;
  estado_preparacion_label: string;
  peso_total: number;
  volumen_total: number;
  chofer: ChoferMini | null;
  lineas: OrdenProducto[];
}

// --- bloques ---
export interface BloqueList {
  id: string;
  fecha: string;                   // ISO
  chofer: ChoferMini | null;              // <- objeto
  chofer_nombre: string;
  total_ordenes: number;
  estado_completitud: EstadoBloque;
  estado_completitud_label: string;
}

export interface BloqueDetail extends Omit<BloqueList, 'estado_completitud_label'> {
  ordenes: Orden[];                // <- con líneas y minis anidados
}

// --- recepcion / distribucion ---
export interface Recepcion {
  orden_id: string;
  cd: CentroMini;
  fecha_recepcion: string;         // ISO
  usuario_receptor: string;
  incidencias: boolean;
}

export interface Distribucion {
  orden_id: string;
  estado: EstadoDistrib;
  estado_label: string;
  fecha_entrega: string | null;    // ISO o null
  chofer_id: string | null;
  bolsas_count?: number;
}

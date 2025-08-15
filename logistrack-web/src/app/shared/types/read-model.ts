export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type EstadoPrep = 'PEN' | 'COM';
export type EstadoBloque = 'INC' | 'COM';
export type EstadoDistrib = 'PEN' | 'ENT' | 'REJ';

export interface Orden {
  id: string;
  pyme_id: string;
  origen_cd_id: string;
  destino_cd_id: string;
  fecha_despacho: string;
  estado_preparacion: EstadoPrep;
  peso_total: number;
  volumen_total: number;
  chofer_id?: string | null;
}
export interface BloqueList {
  id: string;
  fecha: string;
  chofer_id: string;
  chofer_nombre: string;
  total_ordenes: number;
  estado_completitud: EstadoBloque;
}
export interface BloqueDetail extends BloqueList {
  ordenes: Orden[];
}
export interface Recepcion {
  orden_id: string;
  cd_id: string;
  fecha_recepcion: string;
  usuario_receptor: string;
  incidencias: boolean;
}
export interface Distribucion {
  orden_id: string;
  estado: EstadoDistrib;
  fecha_entrega: string | null;
  chofer_id: string | null;
}

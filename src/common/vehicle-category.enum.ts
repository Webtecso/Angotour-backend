/**
 * Enum das categorias de veiculo, sem nenhum import de entidades.
 * Vive aqui para evitar o import circular trip.entity -> vehicle.entity ->
 * driver.entity -> trip.entity, que deixava o enum undefined quando a CLI do
 * TypeORM carregava as entidades por glob.
 */
export enum VehicleCategoryId {
  ANGO_TAXI = 'ango_taxi',
  ANGO_CONFORTO = 'ango_conforto',
  ANGO_EXECUTIVO = 'ango_executivo',
  ANGO_FAMILY = 'ango_family',
  ANGO_GRUPO = 'ango_grupo',
  ANGO_AEROPORTO = 'ango_aeroporto',
  ANGO_TOUR = 'ango_tour',
  ANGO_MOTO = 'ango_moto',
  ANGO_ACESSIVEL = 'ango_acessivel',
}

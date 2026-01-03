export enum AuthProvider {
  Local = 'LOCAL',
  Google = 'GOOGLE',
  Apple = 'APPLE'
}

export enum RoundType {
  Normal = 'NORMAL',
  HochzeitNormal = 'HOCHZEIT_NORMAL',
  HochzeitStill = 'HOCHZEIT_STILL',
  HochzeitUngeklaert = 'HOCHZEIT_UNGEKLAERT',
  SoloDamen = 'SOLO_DAMEN',
  SoloBuben = 'SOLO_BUBEN',
  SoloKreuz = 'SOLO_KREUZ',
  SoloPik = 'SOLO_PIK',
  SoloHerz = 'SOLO_HERZ',
  SoloKaro = 'SOLO_KARO',
  SoloAss = 'SOLO_ASS'
}

export enum SoloType {
  Pflicht = 'PFLICHT',
  Lust = 'LUST'
}

export enum Team {
  RE = 'RE',
  KONTRA = 'KONTRA'
}

export enum RoundResult {
  WON = 'WON',
  LOST = 'LOST',
  DRAW = 'DRAW'
}

export enum CallType {
  RE = 'RE',
  KONTRA = 'KONTRA',
  Keine90 = 'KEINE90',
  Keine60 = 'KEINE60',
  Keine30 = 'KEINE30',
  Schwarz = 'SCHWARZ'
}

export enum BonusType {
  Doko = 'DOKO',
  Fuchs = 'FUCHS',
  Karlchen = 'KARLCHEN'
}

// Type aliases
export type AuthProviderType = AuthProvider;
export type RoundTypeEnum = RoundType;
export type SoloTypeEnumValue = SoloType;
export type TeamEnumValue = Team;
export type CallTypeEnumValue = CallType;
export type BonusTypeEnumValue = BonusType;
export type RoundResultEnumValue = RoundResult;

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  name?: string;
  iat?: number;
  exp?: number;
}

import { SetMetadata } from '@nestjs/common';

// Marca un endpoint como accesible sin JWT (landing público, login, etc.)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

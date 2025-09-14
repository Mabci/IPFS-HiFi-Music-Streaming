declare module 'cookie-parser' {
  import { RequestHandler } from 'express';
  
  interface CookieParseOptions {
    decode?: (val: string) => string;
    secret?: string | string[];
  }
  
  function cookieParser(secret?: string | string[], options?: CookieParseOptions): RequestHandler;
  
  export = cookieParser;
}

import type { EnvData } from 'src/types';

export abstract class ConfigRepository {
  abstract get database(): EnvData['database'];
  abstract get deployTarget(): EnvData['deployTarget'];
  abstract get port(): number;
  abstract get listenAddress(): string;
  abstract get storageDir(): string;
  abstract get registrationEnabled(): boolean;
  abstract get demoMode(): boolean;
  abstract get setupToken(): string | undefined;
  abstract get trustProxyHeaders(): boolean;
}

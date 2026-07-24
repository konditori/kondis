import { defaults } from '@kondis/sdk';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL;

if (!serverUrl) {
  throw new Error('KONDIS_E2E_SERVER_URL must be set');
}

defaults.baseUrl = serverUrl;

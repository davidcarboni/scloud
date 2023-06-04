import { Request, Routes } from './types';

const routes: Routes = {
  '/api/ping': { GET: async (request: Request) => ({ statusCode: 200, body: request }) },
};
export default routes;

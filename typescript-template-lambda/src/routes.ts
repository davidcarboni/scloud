/* eslint-disable no-use-before-define */
import { Routes } from '@scloud/lambda-api/dist/types';
import { placeholder } from './routes/placeholder';

const routes: Routes = {
  '/placeholder': { GET: placeholder },
};

export default routes;

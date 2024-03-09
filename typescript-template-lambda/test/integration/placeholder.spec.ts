import { expect } from 'chai';
import { describe, it } from 'mocha';
import { get } from './request';

describe('placeholder.ts', () => {
  describe('/placeholder', () => {
    before(async () => {
      console.log('set up test');
    });

    it('Placeholder test', async () => {
      // Placeholder API interaction
      const response = await get('/placeholder');

      // Verify the response
      expect(response.status).to.equal(200);
    });
  });
});

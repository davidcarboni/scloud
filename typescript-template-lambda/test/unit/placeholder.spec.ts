import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('placeholder.ts', () => {
  describe('placeholderFunction', () => {
    it('Should run a unit test', () => {
      expect({ placeholder: 'test' }).to.deep.equal({ placeholder: 'test' });
    });
  });
});

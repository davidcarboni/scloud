import { expect } from 'chai';
import { describe, it } from 'mocha';
import { tidy } from 'presigned';

// chai.use(require('chai-as-promised'));

describe('presigned.ts', () => {
  describe('tidy(key)', () => {
    it('Should preserve the key if it doesn\'t need tidying', () => {
      const result = tidy('a/path/to/an/object.json');
      expect(result).to.deep.equal('a/path/to/an/object.json');
    });

    it('Should strip leading slash', () => {
      const result = tidy('/key');
      expect(result).to.deep.equal('key');
    });

    it('Should strip trailing slash', () => {
      const result = tidy('key/');
      expect(result).to.deep.equal('key');
    });

    it('Should remove any random/accidental double slashes in the key', () => {
      const result = tidy('awkwardly/concatenated//path/to/file.json');
      expect(result).to.deep.equal('awkwardly/concatenated/path/to/file.json');
    });
  });
});

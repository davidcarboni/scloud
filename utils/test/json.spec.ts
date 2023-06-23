import { expect } from 'chai';
import { parseJson } from 'json';
import { describe, it } from 'mocha';

// chai.use(require('chai-as-promised'));

describe('parseJson', () => {
  it('Should parse valid json', () => {
    const result = parseJson('{"key":"value"}');
    expect(result).to.deep.equal({ key: 'value' });
  });

  it('Should gracefully parse undefined', () => {
    const result = parseJson(undefined);
    expect(result).to.equal(undefined);
  });

  it('Should gracefully parse empty string', () => {
    const result = parseJson('');
    expect(result).to.equal(undefined);
  });

  it('Should gracefully parse invalid json', () => {
    const result = parseJson('this is not valid json');
    expect(result).to.equal(undefined);
  });
});

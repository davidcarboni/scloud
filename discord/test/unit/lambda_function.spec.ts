// import { expect } from 'chai';
import { describe, it } from 'mocha';

// chai.use(require('chai-as-promised'));

describe('Placeholder test', () => {
  let expect: Chai.ExpectStatic;

  before(async () => {
    // Dynamically import chai
    const chai = await import('chai');
    expect = chai.expect;
  });

  it('Given a condition, when we take an action, we should get a result', () => {
    expect(true).to.be.true;
  });
});

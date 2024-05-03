import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  matchRoute,
  parseBody, standardHeaders, standardPath,
  standardQueryParameters,
} from '../src/helpers';

describe('helpers.ts', () => {
  describe('standardPath', () => {
    it('Should parse a standard path', () => {
      const path = standardPath('/a/b/c');
      expect(path).to.equal('/a/b/c');
    });

    it('Should parse an empty path', () => {
      const path = standardPath('');
      expect(path).to.equal('/');
    });

    it('Should parse an root path', () => {
      const path = standardPath('/');
      expect(path).to.equal('/');
    });

    it('Should remove a trailing slash', () => {
      const path = standardPath('/path/');
      expect(path).to.equal('/path');
    });

    it('Should add a leading slash', () => {
      const path = standardPath('path');
      expect(path).to.equal('/path');
    });

    it('Should lowercase', () => {
      const path = standardPath('/PATH');
      expect(path).to.equal('/path');
    });

    it('Should remove blank segments', () => {
      const path = standardPath('/a//b');
      expect(path).to.equal('/a/b');
    });
  });

  describe('standardQueryParameters', () => {
    it('Should handle a query string', () => {
      const query = standardQueryParameters({ a: '1', b: '2' });
      expect(query).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should remove blank values', () => {
      const query = standardQueryParameters({
        a: '1', b: '2', c: undefined, d: '',
      });
      expect(query).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should handle no query', () => {
      const query = standardQueryParameters(null);
      expect(query).to.deep.equal({});
    });
  });

  describe('standardHeaders', () => {
    it('Should provide original header names plus lowercased header names', () => {
      const headers = standardHeaders({ Cookie: '1', 'Content-Type': '2' });
      expect(headers).to.deep.equal({
        Cookie: '1',
        cookie: '1',
        'Content-Type': '2',
        'content-type': '2',
      });
    });

    it('Should remove blank values', () => {
      const headers = standardHeaders({ a: '1', b: '', c: undefined });
      expect(headers).to.deep.equal({ a: '1' });
    });
  });

  describe('parseBody', () => {
    it('Should parse body', () => {
      const query = parseBody(JSON.stringify({ a: '1', b: '2' }), false);
      expect(query).to.deep.equal({ a: '1', b: '2' });
    });
    it('Should parse a base-64 encoded body', () => {
      const query = parseBody(Buffer.from(JSON.stringify({ a: '1', b: '2' })).toString('base64'), true);
      expect(query).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should gracefully handle unparseable body', () => {
      const query = parseBody('Ain\'t nobody here but us chickens', false);
      expect(query).to.deep.equal({});
    });

    it('Should handle empty body', () => {
      const query = parseBody('', false);
      expect(query).to.deep.equal({});
    });

    it('Should handle no body', () => {
      const query = parseBody(null, false);
      expect(query).to.deep.equal({});
    });
  });

  describe('matchRoute', () => {
    const route1 = {};
    const route2 = {};
    const routes = {
      '/path1': route1,
      '/path2': route2,
    };

    it('Should match an exact route', () => {
      const result = matchRoute(routes, '/path1');
      expect(result).to.equal(route1);
    });

    it('Should not match an unknown route', () => {
      const result = matchRoute(routes, '/path3');
      expect(result).to.be.undefined;
    });

    it('Should match an route casae-insensitively', () => {
      const result = matchRoute(routes, '/Path2');
      expect(result).to.equal(route2);
    });
  });
});

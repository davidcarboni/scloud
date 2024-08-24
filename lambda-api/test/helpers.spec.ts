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
    const route3 = {};
    const route4 = {};
    const route5 = {};
    const routes = {
      '/path1': route1,
      '/path2': route2,
      '/path/{param1}/subpath1': route3,
      '/path/{param2}': route4,
      '/path/{param3}': route5,
    };

    it('Should match an exact route', () => {
      const result = matchRoute(routes, '/path1');
      expect(result.route).to.equal(route1);
      expect(result.params).to.deep.equal({}); // Guarantee a minimum of an emply object - never undefined (so we don't have to check for it)
    });

    it('Should not match an unknown route', () => {
      const result = matchRoute(routes, '/path3');
      expect(result.route).to.be.undefined;
      expect(result.params).to.deep.equal({}); // Guarantee a minimum of an emply object - never undefined (so we don't have to check for it)
    });

    it('Should match an route case-insensitively', () => {
      const result = matchRoute(routes, '/Path2');
      expect(result.route).to.equal(route2);
      expect(result.params).to.deep.equal({}); // Guarantee a minimum of an emply object - never undefined (so we don't have to check for it)
    });

    it('Should match a parameter', () => {
      const result = matchRoute(routes, '/path/123');
      // NB: Matching shouldn't pick up {param2} while traversing the list (different length, no match)
      // and should not continue on to find {param3} (stop at the first match)
      expect(result.route).to.equal(route4);
      expect(result.params).to.deep.equal({ param2: '123' });
    });
  });
});

import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  buildCookie,
  getHeader,
  matchRoute,
  parseBody, parseCookie, setHeader, standardHeaders, standardPath,
  standardQueryParameters,
} from '../src/helpers';
import { Routes } from '@/types';

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
    it('Should set undefined values to empty strings', () => {
      const headers = standardHeaders({ a: '1', b: '', c: undefined });
      expect(headers).to.deep.equal({ a: '1', b: '', c: '' });
    });
  });

  describe('getheader', () => {
    it('Should access a header value case-insensitively', () => {
      const headers = { 'Content-Type': 'text/plain' };
      expect(getHeader('content-type', headers)).to.equal('text/plain');
    });

    it('Should return undefined if the header is not set', () => {
      const headers = { 'Content-Type': 'text/plain' };
      expect(getHeader('Origin', headers)).to.be.undefined;
    });
  });

  describe('setheader', () => {
    it('Should update a header value case-insensitively', () => {
      const headers = { 'Content-Type': 'text/plain' };
      setHeader('content-type', 'application/json', headers);
      expect(getHeader('Content-Type', headers)).to.equal('application/json');
      expect(Object.keys(headers)).to.deep.equal(['Content-Type']);
    });

    it('Should set a header value', () => {
      const headers = {};
      setHeader('content-type', 'application/json', headers);
      expect(Object.keys(headers)).to.deep.equal(['content-type']);
    });
  });

  describe('parseCookie', () => {
    it('Should parse a cookie', () => {
      const headers = { Cookie: 'a=1; b=2' };
      const cookies = parseCookie(headers);
      expect(cookies).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should gracefully handle no cookies', () => {
      const headers = {};
      const cookies = parseCookie(headers);
      expect(cookies).to.deep.equal({});
    });

    it('Should gracefully handle an empty cookie value', () => {
      const headers = { Cookie: 'a=1; b=; c=3' };
      const cookies = parseCookie(headers);
      expect(cookies).to.deep.equal({ a: '1', c: '3' });
    });
  });

  describe('buildCookie', () => {
    it('Should build a cookie header from a response', () => {
      const response = { cookies: { a: '1', b: '2' } };
      const cookie = buildCookie(response);
      expect(cookie).to.deep.equal([
        'a=1; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax',
        'b=2; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax',
      ]);
    });

    it('Should unset a cookie value if explicitly blank', () => {
      const response = { cookies: { a: '' } };
      const cookie = buildCookie(response);
      const expectedIsh = 'a=; Expires=Thu, 07 Aug 2025 18:04:35 GMT; HttpOnly; Secure; SameSite=Lax';
      expect((cookie || [])[0].slice(0, 12)).to.equal(expectedIsh.slice(0, 12));
      expect((cookie || [])[0].slice(-32)).to.equal(expectedIsh.slice(-32));
    });

    it('Should gracefully handle no cookies', () => {
      const response = {};
      const cookie = buildCookie(response);
      expect(cookie).to.be.undefined;
    });
  });

  describe('parseBody', () => {
    it('Should parse body', () => {
      const body = parseBody(JSON.stringify({ a: '1', b: '2' }), false);
      expect(body).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should parse a base-64 encoded body', () => {
      const body = parseBody(Buffer.from(JSON.stringify({ a: '1', b: '2' })).toString('base64'), true);
      expect(body).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should parse an application/x-www-form-urlencoded body', () => {
      const body = parseBody('a=1&b=2', false, 'application/x-www-form-urlencoded');
      expect(body).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should gracefully handle unparseable body', () => {
      const body = parseBody('Ain\'t nobody here but us chickens', false);
      expect(body).to.deep.equal('Ain\'t nobody here but us chickens',);
    });

    it('Should handle empty body', () => {
      const body = parseBody('', false);
      expect(body).to.deep.equal({});
    });

    it('Should handle no body', () => {
      const body = parseBody(null, false);
      expect(body).to.deep.equal({});
    });
  });

  describe('matchRoute', () => {
    const route1 = {};
    const route2 = {};
    const route3 = {};
    const route4 = {};
    const route5 = {};
    const route6 = {};
    const routes: Routes = {
      '/path1': route1,
      '/path2': route2,
      '/path/{param3}/subpath1': route3,
      '/path/{param4}': route4,
      '/path/{param5}': route5,
      '/camelCase/{camelCaseParam}': route6,
    };

    it('Should match an exact route', () => {
      const result = matchRoute(routes, '/path1');
      expect(result.methods).to.equal(route1);
      expect(result.params).to.deep.equal({}); // Guarantee a minimum of an emply object - never undefined (so we don't have to check for it)
    });

    it('Should match a route case-insensitively', () => {
      const result = matchRoute(routes, '/Path2');
      expect(result.methods).to.equal(route2);
      expect(result.params).to.deep.equal({}); // Guarantee a minimum of an emply object - never undefined (so we don't have to check for it)
    });

    it('Should not match an unknown route', () => {
      const result = matchRoute(routes, '/pathX');
      expect(result.methods).to.be.undefined;
      expect(result.params).to.deep.equal({}); // Guarantee a minimum of an emply object - never undefined (so we don't have to check for it)
    });

    it('Should match a parameter', () => {
      const result = matchRoute(routes, '/path/123');
      // NB: Matching shouldn't pick up {param3} while traversing the list (different length, no match)
      // and should not continue on to find {param5} (stop at the first match)
      expect(result.methods).to.equal(route4);
      expect(result.params).to.deep.equal({ param4: '123' });
    });

    it('Should match a parameter case-insensitively', () => {
      const result = matchRoute(routes, '/path/123');
      expect(result.methods).to.equal(route4);
      expect(result.params).to.deep.equal({ param4: '123' });
    });

    it('Should match a cametCaseparameter', () => {
      const result = matchRoute(routes, '/camelCase/camelCaseValue');
      expect(result.methods).to.equal(route6);
      expect(result.params).to.deep.equal({ camelCaseParam: 'camelCaseValue' });
    });
  });
});

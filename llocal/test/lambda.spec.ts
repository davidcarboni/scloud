import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  parseBody, standardHeaders, standardPath,
  standardQueryParameters,
} from 'lambda';

describe('lambda.ts', () => {
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
    it('Should lowercase header names', () => {
      const query = standardHeaders({ Cookie: '1', 'Content-Type': '2' });
      expect(query).to.deep.equal({ cookie: '1', 'content-type': '2' });
    });

    it('Should remove blank values', () => {
      const query = standardHeaders({ a: '1', b: '', c: undefined });
      expect(query).to.deep.equal({ a: '1' });
    });
  });

  describe('parseBody', () => {
    it('Should parse body', () => {
      const query = parseBody(JSON.stringify({ a: '1', b: '2' }));
      expect(query).to.deep.equal({ a: '1', b: '2' });
    });

    it('Should gracefully handle unparseable body', () => {
      const query = parseBody('Ain\'t nobody here but us chickens');
      expect(query).to.deep.equal({});
    });

    it('Should handle empty body', () => {
      const query = parseBody('');
      expect(query).to.deep.equal({});
    });

    it('Should handle no body', () => {
      const query = parseBody(null);
      expect(query).to.deep.equal({});
    });
  });
});

// /**
//  * Parses the body (if present) to a JSON string. Returns at mimimum an empty object.
//  * @param body APIGatewayProxyEvent.body
//  */
// export function parseBody(body: string | null): { [name: string]: string; } {
//   if (!body) return {};
//   let result = {};
//   try {
//     result = JSON.parse(body);
//   } catch (e) {
//     console.error(`Error parsing request body: ${e}`);
//   }
//   return result;
// }

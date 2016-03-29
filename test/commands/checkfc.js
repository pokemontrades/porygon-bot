const expect = require('chai').expect;
const _ = require('lodash');
const checkfc = require('../../commands/checkfc');
const getResponse = message => _.last(_.words(checkfc.response({message_match: checkfc.message_regex.exec(message)})));
describe('checkfc', () => {
  it('correctly identifies valid friendcodes', () => {
    expect(getResponse('.checkfc 0000-0000-0135')).to.equal('YES');
    expect(getResponse('.checkfc 3540-1693-1135')).to.equal('YES');
  });
  it('correctly identifies invalid friendcodes', () => {
    expect(getResponse('.checkfc 0000-0000-0000')).to.equal('NO');
    expect(getResponse('.checkfc 5497-5581-4023')).to.equal('NO'); // 2^39 + 135
  });
});

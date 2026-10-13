import { parseScenario } from './scenario';

describe('parseScenario', () => {
  it.each<[string, boolean, boolean, boolean]>([
    ['', true, false, false],
    ['?interactive=0', false, false, false],
    ['?empty=1', true, true, false],
    ['?visual=1', false, false, true],
  ])('§8 parseScenario reads "%s" as interactive %s, empty %s, visual %s', (search, interactive, empty, visual) => {
    expect(parseScenario(search)).toEqual({ interactive, empty, visual });
  });
});

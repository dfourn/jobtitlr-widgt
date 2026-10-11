import { arrayOf, field, isRecord, stringOf } from '../json';

export interface RubricCriterion {
  readonly id: string;
  readonly brief: readonly string[];
  readonly question: string;
  /** Anchor descriptions for scores 0-3. */
  readonly anchors: Readonly<Record<'0' | '1' | '2' | '3', string>>;
}

export interface Rubric {
  readonly instructions: string;
  readonly criteria: readonly RubricCriterion[];
}

/** Validates `review/rubric.json`. Throws with a clear message when it is malformed. */
export function parseRubric(json: unknown): Rubric {
  const criteria = arrayOf(field(json, 'criteria')).map((raw, index) => {
    const id = stringOf(field(raw, 'id'));
    const question = stringOf(field(raw, 'question'));
    const anchors = field(raw, 'anchors');
    if (id === null || question === null || !isRecord(anchors)) {
      throw new Error(`rubric criterion ${String(index)} needs an id, a question and anchors`);
    }
    const anchor = (key: '0' | '1' | '2' | '3'): string => {
      const text = stringOf(anchors[key]);
      if (text === null) throw new Error(`rubric criterion ${id} is missing anchor ${key}`);
      return text;
    };
    return {
      id,
      question,
      brief: arrayOf(field(raw, 'brief')).map((b) => stringOf(b) ?? ''),
      anchors: { '0': anchor('0'), '1': anchor('1'), '2': anchor('2'), '3': anchor('3') },
    };
  });
  if (criteria.length === 0) throw new Error('rubric has no criteria');
  return { instructions: stringOf(field(json, 'instructions')) ?? '', criteria };
}

/** The JSON Schema passed to `claude --json-schema`: one 0-3 score and evidence per criterion. */
export function judgeSchema(rubric: Rubric): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      criteria: {
        type: 'array',
        minItems: rubric.criteria.length,
        maxItems: rubric.criteria.length,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: rubric.criteria.map((c) => c.id) },
            score: { type: 'integer', minimum: 0, maximum: 3 },
            evidence: { type: 'string' },
          },
          required: ['id', 'score', 'evidence'],
          additionalProperties: false,
        },
      },
    },
    required: ['criteria'],
    additionalProperties: false,
  };
}

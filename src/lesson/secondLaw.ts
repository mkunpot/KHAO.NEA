/**
 * THE canonical lesson: "The Second Law of Thermodynamics", 15 minutes.
 *
 * This file is the only place lesson content lives. The Presentation, Live Student and Self-Study
 * renderers all read this object; none of them contains lesson text of its own.
 * Strings may contain inline math between $...$ (rendered with KaTeX).
 */

import type { LessonDefinition } from './types'

const tex = String.raw

const HOT_K = 400
const COLD_K = 300
const EQUILIBRIUM_K = (HOT_K + COLD_K) / 2
const GAP_K = HOT_K - COLD_K

export const secondLawLesson: LessonDefinition = {
  id: 'second-law',

  metadata: {
    title: 'The Second Law of Thermodynamics',
    subtitle: 'Why do processes run in one direction?',
    level: 'University physics · introductory thermodynamics',
    durationMinutes: 15,
    prerequisites: [
      'Thermodynamic systems and state variables',
      'Temperature, heat and work',
      'The First Law',
      'Ideal gas basics',
    ],
  },

  objectives: [
    'Explain why the First Law alone cannot tell us which way a process runs.',
    'Predict the direction of spontaneous heat flow between two bodies at different temperatures.',
    tex`Use $\Delta S_{\text{total}} \ge 0$ for an isolated system to decide whether a process can happen spontaneously.`,
    tex`Distinguish reversible ($\Delta S_{\text{total}} = 0$) from irreversible ($\Delta S_{\text{total}} > 0$) processes.`,
    'Relate the Second Law to the limits on heat engines.',
  ],

  simulations: {
    'thermal-contact': {
      id: 'thermal-contact',
      kind: 'thermal-contact',
      title: 'Two bodies in thermal contact',
      params: { hotK: HOT_K, coldK: COLD_K, heatCapacityJPerK: 1000, timeConstantS: 2 },
      assumptions: [
        'Two identical finite bodies, each with the same constant heat capacity C = 1.0 kJ/K.',
        'The pair is isolated from its surroundings: energy only moves between the two bodies.',
        'All temperatures are in kelvin.',
        'The demo relaxes exponentially toward equilibrium; the time constant only sets how fast the animation runs.',
      ],
    },
  },

  questions: {
    prediction: {
      id: 'prediction',
      kind: 'prediction',
      prompt: 'If they are placed in thermal contact, what happens?',
      options: [
        { id: 'A', text: 'Heat flows hot → cold' },
        { id: 'B', text: 'Heat flows cold → hot' },
        { id: 'C', text: 'No heat transfer' },
        { id: 'D', text: 'Either direction is equally likely' },
      ],
      correctOptionId: 'A',
      explanation:
        'Heat flows spontaneously from the hotter body to the colder one. Everyday experience agrees — but nothing we have used so far, energy conservation included, says it could not run the other way.',
    },

    'first-law': {
      id: 'first-law',
      kind: 'concept-check',
      prompt: 'Does the First Law explain why heat flows in this direction?',
      options: [
        { id: 'yes', text: 'Yes' },
        { id: 'no', text: 'No' },
      ],
      correctOptionId: 'no',
      explanation:
        'The First Law enforces conservation of energy. It does not determine the spontaneous direction: energy would be conserved just as well if heat flowed from the cold body into the hot one.',
    },

    'reverse-requirement': {
      id: 'reverse-requirement',
      kind: 'concept-check',
      prompt: 'What is required to move heat from cold to hot?',
      options: [
        { id: 'A', text: 'Nothing' },
        { id: 'B', text: 'External work' },
        { id: 'C', text: 'Violate conservation of energy' },
        { id: 'D', text: 'Reduce the temperature scale' },
      ],
      correctOptionId: 'B',
      explanation:
        'Moving heat from cold to hot takes external work — as in a refrigerator, air conditioner or heat pump. Energy is still conserved, and the machine rejects extra heat to its surroundings, so the total entropy still does not decrease.',
    },

    return: {
      id: 'return',
      kind: 'concept-check',
      prompt: `If we wait long enough, will the system spontaneously return to ${HOT_K} K and ${COLD_K} K?`,
      options: [
        { id: 'yes', text: 'Yes' },
        { id: 'no', text: 'No' },
      ],
      correctOptionId: 'no',
      explanation: `No. For macroscopic bodies the spontaneous return is overwhelmingly improbable: there are astronomically more microscopic arrangements consistent with equal temperatures than with a ${GAP_K} K difference. That is what makes the process irreversible.`,
    },

    exit: {
      id: 'exit',
      kind: 'exit',
      prompt: 'Which statement best captures the Second Law?',
      options: [
        { id: 'A', text: 'Energy cannot be created or destroyed.' },
        { id: 'B', text: 'Heat is stored inside an object.' },
        { id: 'C', text: 'For an isolated system, spontaneous processes do not decrease total entropy.' },
        { id: 'D', text: 'Entropy of every object must always increase.' },
      ],
      correctOptionId: 'C',
      explanation:
        'A is the First Law. B is a misconception: heat is energy in transit, not something stored. D is false: the hot body’s entropy decreased in our simulation — it is the total entropy of the isolated system that cannot decrease.',
    },
  },

  steps: [
    // 0–2 min ─ Prediction
    {
      id: 'prediction',
      title: 'Prediction',
      minutes: 2,
      blocks: [
        {
          id: 'prediction-setup',
          type: 'concept',
          text: `Two identical bodies, isolated from everything else: one at ${HOT_K} K, one at ${COLD_K} K.`,
        },
        {
          id: 'prediction-sim',
          type: 'simulation',
          simulationId: 'thermal-contact',
          display: 'initial',
          controls: [],
          readouts: { tHot: 0, tCold: 0 },
        },
        { id: 'prediction-question', type: 'question', questionId: 'prediction' },
        {
          id: 'prediction-explain',
          type: 'explanation',
          title: 'Before we calculate',
          paragraphs: [
            'Put a hot block against a cold one, with nothing else around, and you already know what happens. This lesson asks why it happens in that direction — and looks for a quantity that predicts it.',
            tex`Both bodies are identical: each has the same constant heat capacity $C$. Together they form an isolated system, so no energy crosses the outer boundary.`,
          ],
        },
      ],
    },

    // 2–5 min ─ Run the simulation
    {
      id: 'simulation',
      title: 'Run the simulation',
      minutes: 3,
      blocks: [
        {
          id: 'simulation-flow',
          type: 'concept',
          text: 'Energy leaves the hot body and enters the cold one, and the two temperatures approach each other.',
        },
        {
          id: 'simulation-sim',
          type: 'simulation',
          simulationId: 'thermal-contact',
          display: 'live',
          controls: ['connect', 'reset'],
          readouts: { tHot: 0, tCold: 0, heat: 0 },
        },
        {
          id: 'simulation-final-temperature',
          type: 'equation',
          reveal: 1,
          latex: tex`T_f = \frac{T_1 + T_2}{2} = ${EQUILIBRIUM_K}\ \text{K}`,
          caption: tex`Energy conservation fixes $T_f$ — not the direction.`,
        },
        { id: 'simulation-question', type: 'question', questionId: 'first-law', afterReveal: 1 },
        {
          id: 'simulation-explain',
          type: 'explanation',
          title: 'What the First Law does and does not say',
          paragraphs: [
            tex`The pair is isolated, so the First Law gives $Q_{\text{hot}} + Q_{\text{cold}} = 0$: whatever energy one body loses, the other gains. With equal heat capacities this fixes the final temperature, $T_f = (T_1 + T_2)/2$.`,
            'But that bookkeeping is symmetric. A process in which the hot body got hotter and the cold body colder would conserve energy just as well, so energy conservation alone cannot choose the direction.',
          ],
        },
      ],
    },

    // 5–8 min ─ Entropy (progressive reveal)
    {
      id: 'entropy',
      title: 'Entropy decides the direction',
      minutes: 3,
      blocks: [
        {
          id: 'entropy-definition',
          type: 'equation',
          latex: tex`\Delta S = C \ln\frac{T_{\text{final}}}{T_{\text{initial}}}`,
          caption: 'constant C · temperatures in kelvin',
        },
        {
          id: 'entropy-sim',
          type: 'simulation',
          simulationId: 'thermal-contact',
          display: 'settled',
          controls: [],
          readouts: { tHot: 0, tCold: 0, heat: 0, dSHot: 1, dSCold: 2, dSTotal: 3 },
        },
        { id: 'entropy-hot', type: 'equation', reveal: 1, latex: tex`\Delta S_{\text{hot}} < 0` },
        { id: 'entropy-cold', type: 'equation', reveal: 2, latex: tex`\Delta S_{\text{cold}} > 0` },
        { id: 'entropy-total', type: 'equation', reveal: 3, latex: tex`\Delta S_{\text{total}} > 0` },
        {
          id: 'entropy-law',
          type: 'equation',
          reveal: 4,
          tone: 'key',
          latex: tex`\Delta S_{\text{total}} \ge 0`,
          caption: 'for an isolated system',
        },
        {
          id: 'entropy-more',
          type: 'concept',
          reveal: 4,
          text: 'The cold body gains more entropy than the hot body loses.',
        },
        {
          id: 'entropy-explain',
          type: 'explanation',
          title: 'Entropy as the direction-finder',
          paragraphs: [
            tex`Entropy $S$ is a state function. For a body of constant heat capacity $C$ taken from $T_i$ to $T_f$, $\Delta S = C\ln(T_f/T_i)$, with temperatures in kelvin.`,
            tex`The hot body cools, so $\Delta S_{\text{hot}} < 0$. The cold body warms, so $\Delta S_{\text{cold}} > 0$. The same energy flows out at a high temperature and in at a low one, so the cold body gains more entropy than the hot body loses and $\Delta S_{\text{total}} > 0$.`,
            tex`For an isolated system $\Delta S_{\text{total}} \ge 0$: zero only in the idealised reversible limit, positive for every real spontaneous process. Entropy is not simply "disorder" — it is the quantity whose total change tells us which processes can happen.`,
          ],
        },
      ],
    },

    // 8–10 min ─ Reverse direction
    {
      id: 'reverse',
      title: 'The reverse direction',
      minutes: 2,
      blocks: [
        {
          id: 'reverse-hypothetical',
          type: 'concept',
          tone: 'warning',
          text: 'Hypothetical: the same energy flows from the cold body to the hot body.',
        },
        {
          id: 'reverse-sim',
          type: 'simulation',
          simulationId: 'thermal-contact',
          display: 'live',
          controls: ['reverse', 'reset'],
          readouts: { tHot: 0, tCold: 0, heat: 0, dSTotal: 0 },
        },
        { id: 'reverse-first-law', type: 'concept', text: 'The First Law has no objection.' },
        { id: 'reverse-question', type: 'question', questionId: 'reverse-requirement' },
        {
          id: 'reverse-machines',
          type: 'concept',
          reveal: 1,
          text: 'Refrigerator · air conditioner · heat pump: each moves heat from cold to hot, and each needs work input.',
        },
        {
          id: 'reverse-explain',
          type: 'explanation',
          title: 'Running it backwards',
          paragraphs: [
            tex`Suppose the same amount of energy flowed from the cold body to the hot one. The First Law is satisfied — nothing is created or destroyed. But the cold body would lose more entropy than the hot body gains, so $\Delta S_{\text{total}} < 0$, which an isolated macroscopic system cannot do spontaneously.`,
            'Refrigerators, air conditioners and heat pumps do move heat from cold to hot. They need external work, and they reject extra heat to their surroundings; counting the surroundings, total entropy still does not decrease.',
          ],
        },
      ],
    },

    // 10–12 min ─ Irreversibility
    {
      id: 'irreversibility',
      title: 'Irreversibility',
      minutes: 2,
      blocks: [
        {
          id: 'irreversibility-equilibrium',
          type: 'concept',
          text: `Both bodies have reached ${EQUILIBRIUM_K} K.`,
        },
        {
          id: 'irreversibility-sim',
          type: 'simulation',
          simulationId: 'thermal-contact',
          display: 'settled',
          controls: [],
          readouts: { tHot: 0, tCold: 0, dSTotal: 0 },
        },
        { id: 'irreversibility-question', type: 'question', questionId: 'return' },
        {
          id: 'irreversibility-label',
          type: 'concept',
          reveal: 1,
          tone: 'stamp',
          text: 'IRREVERSIBLE PROCESS',
        },
        {
          id: 'irreversibility-micro',
          type: 'concept',
          reveal: 1,
          text: 'The microscopic laws are time-reversal symmetric. A macroscopic return is not forbidden by mechanics — it is overwhelmingly improbable.',
        },
        {
          id: 'irreversibility-explain',
          type: 'explanation',
          title: 'Why the temperatures do not un-mix',
          paragraphs: [
            tex`A process with $\Delta S_{\text{total}} > 0$ is irreversible: the isolated system cannot return to its initial state by itself. A reversible process ($\Delta S_{\text{total}} = 0$) is an idealised limiting case.`,
            'This does not contradict microscopic mechanics, whose equations are symmetric under time reversal. Irreversibility is statistical: there are astronomically more microscopic arrangements consistent with equal temperatures than with a large temperature difference, so for macroscopic bodies the spontaneous return is overwhelmingly improbable.',
          ],
        },
      ],
    },

    // 12–14 min ─ Heat engines
    {
      id: 'heat-engine',
      title: 'Connection to heat engines',
      minutes: 2,
      blocks: [
        {
          id: 'engine-diagram',
          type: 'diagram',
          diagramId: 'heat-engine',
          caption: 'A heat engine operating in a cycle between two reservoirs.',
        },
        {
          id: 'engine-first-law',
          type: 'equation',
          latex: tex`Q_H = W + Q_C`,
          caption: tex`First Law over one complete cycle ($\Delta U = 0$)`,
        },
        {
          id: 'engine-limit',
          type: 'concept',
          reveal: 1,
          tone: 'key',
          text: 'A cyclic engine cannot convert all absorbed heat from a single reservoir entirely into work.',
        },
        {
          id: 'engine-explain',
          type: 'explanation',
          title: 'Heat engines',
          paragraphs: [
            tex`A heat engine takes heat $Q_H$ from a hot reservoir, delivers work $W$ and rejects heat $Q_C$ to a cold reservoir. Over one full cycle its internal energy returns to its starting value, so the First Law gives $Q_H = W + Q_C$.`,
            tex`The Second Law adds a limit: a cyclic engine cannot turn all the heat it absorbs from a single reservoir into work — some $Q_C > 0$ must be rejected. (Look ahead: over a cycle only the reservoirs change entropy, $\Delta S_{\text{total}} = Q_C/T_C - Q_H/T_H \ge 0$, and that cannot hold with $Q_C = 0$.)`,
          ],
        },
      ],
    },

    // 14–15 min ─ Exit question and summary
    {
      id: 'exit',
      title: 'Exit question',
      minutes: 1,
      blocks: [
        { id: 'exit-question', type: 'question', questionId: 'exit' },
        { id: 'exit-summary', type: 'summary', reveal: 1 },
      ],
    },
  ],

  summary: {
    heading: 'Summary',
    rows: [
      { law: 'First Law', question: 'Is energy conserved?' },
      {
        law: 'Second Law',
        question: 'Which direction occurs spontaneously?',
        equation: tex`\Delta S_{\text{total}} \ge 0`,
        note: 'for an isolated system',
      },
    ],
  },
}

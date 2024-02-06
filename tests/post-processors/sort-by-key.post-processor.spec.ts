import { expect } from 'chai';

import { PostProcessorInterface } from '../../src/post-processors/post-processor.interface.js';
import { SortByKeyPostProcessor } from '../../src/post-processors/sort-by-key.post-processor.js';
import { TranslationCollection } from '../../src/utils/translation.collection.js';

describe('SortByKeyPostProcessor', () => {
	let processor: PostProcessorInterface;

	beforeEach(() => {
		processor = new SortByKeyPostProcessor();
	});

	it('should sort keys alphanumerically', () => {
		const collection = new TranslationCollection({
			z: 'last value',
			a: 'a value',
			'9': 'a numeric key',
			b: 'another value'
		});
		const extracted = new TranslationCollection();
		const existing = new TranslationCollection();

		expect(processor.process(collection, extracted, existing).values).to.deep.equal({
			'9': 'a numeric key',
			a: 'a value',
			b: 'another value',
			z: 'last value'
		});
	});

	it('should perform case insensitive sorting', () => {
		const collection = new TranslationCollection({
			c: 'letter c',
			j: 'letter j',
			b: 'letter b',
			a: 'letter a',
			h: 'letter h',
			B: 'letter B',
			H: 'letter H',
			i: 'letter i',
			C: 'letter C',
			e: 'letter e',
			f: 'letter f',
			d: 'letter d',
			A: 'letter A',
			g: 'letter g',
		});

		expect(processor.process(collection, new TranslationCollection(), new TranslationCollection()).values).to.deep.equal({
			A: 'letter A',
			a: 'letter a',
			B: 'letter B',
			b: 'letter b',
			c: 'letter c',
			C: 'letter C',
			d: 'letter d',
			e: 'letter e',
			f: 'letter f',
			g: 'letter g',
			H: 'letter H',
			h: 'letter h',
			i: 'letter i',
			j: 'letter j',
		});
	});
});

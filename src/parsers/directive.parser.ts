import {
	AST,
	ASTWithSource,
	Binary,
	BindingPipe,
	Conditional,
	Interpolation,
	LiteralArray,
	LiteralMap,
	LiteralPrimitive,
	parseTemplate,
	TmplAstBoundAttribute as BoundAttribute,
	TmplAstElement as Element,
	TmplAstNode as Node,
	TmplAstTemplate as Template,
	TmplAstText as Text,
	TmplAstTextAttribute as TextAttribute,
	ParseSourceSpan,
	TmplAstIfBlock,
	TmplAstSwitchBlock,
	TmplAstForLoopBlock,
	TmplAstDeferredBlock
} from '@angular/compiler';

import { ParserInterface } from './parser.interface.js';
import { TranslationCollection } from '../utils/translation.collection.js';
import { isPathAngularComponent, extractComponentInlineTemplate } from '../utils/utils.js';

interface BlockNode {
	nameSpan: ParseSourceSpan;
	sourceSpan: ParseSourceSpan;
	startSourceSpan: ParseSourceSpan;
	endSourceSpan: ParseSourceSpan | null;
	children: Node[] | undefined;
	visit<Result>(visitor: unknown): Result;
}

const TRANSLATE_ATTR_NAMES = ['translate'];
type ElementLike = Element | Template;

export class DirectiveParser implements ParserInterface {
	constructor(private readonly attrNames?: string[]) {
		this.attrNames = attrNames && attrNames.length ? attrNames : TRANSLATE_ATTR_NAMES;
	}

	public extract(source: string, filePath: string): TranslationCollection {
		let collection: TranslationCollection = new TranslationCollection();

		if (filePath && isPathAngularComponent(filePath)) {
			source = extractComponentInlineTemplate(source);
		}
		const nodes: Node[] = this.parseTemplate(source, filePath);
		const elements: ElementLike[] = this.getElementsWithTranslateAttribute(nodes);

		elements.forEach((element) => {
			const attributes = this.getAttributes(element, this.attrNames);
			if (attributes?.length && attributes.filter(a => a?.value)?.length) {
				attributes.filter(a => a?.value)
					.forEach(attribute => collection = collection.add(attribute.value));
				return;
			}

			const boundAttributes = this.getBoundAttributes(element, this.attrNames);
			if (boundAttributes?.length && boundAttributes.filter(a => a?.value)?.length) {
				boundAttributes.filter(a => a?.value).forEach(boundAttribute => {
					this.getLiteralPrimitives(boundAttribute.value).forEach((literalPrimitive) => {
						collection = collection.add(literalPrimitive.value);
					});
				});
				return;
			}

			const textNodes = this.getTextNodes(element);
			textNodes.forEach((textNode) => {
				collection = collection.add(textNode.value.trim());
			});
		});
		return collection;
	}

	/**
	 * Find all ElementLike nodes with a translate attribute
	 * @param nodes
	 */
	protected getElementsWithTranslateAttribute(nodes: Node[]): ElementLike[] {
		let elements: ElementLike[] = [];
		nodes.filter(this.isElementLike).forEach((element) => {
			if (this.hasAttributes(element, this.attrNames)) {
				elements = [...elements, element];
			}
			if (this.hasBoundAttributes(element, this.attrNames)) {
				elements = [...elements, element];
			}
			const childElements = this.getElementsWithTranslateAttribute(element.children);
			if (childElements.length) {
				elements = [...elements, ...childElements];
			}
		});

		nodes.filter(this.isBlockNode).forEach((node) => elements.push(...this.getElementsWithTranslateAttributeFromBlockNodes(node)));

		return elements;
	}

	/**
	 * Get the child elements that are inside a block node (e.g. @if, @deferred)
	 */
	protected getElementsWithTranslateAttributeFromBlockNodes(blockNode: BlockNode) {
		let blockChildren = blockNode.children;

		if (blockNode instanceof TmplAstIfBlock) {
			blockChildren = blockNode.branches.map((branch) => branch.children).flat();
		}

		if (blockNode instanceof TmplAstSwitchBlock) {
			blockChildren = blockNode.cases.map((branch) => branch.children).flat();
		}

		if (blockNode instanceof TmplAstForLoopBlock) {
			const emptyBlockChildren = blockNode.empty?.children ?? [];
			blockChildren.push(...emptyBlockChildren);
		}

		if (blockNode instanceof TmplAstDeferredBlock) {
			const placeholderBlockChildren = blockNode.placeholder?.children ?? [];
			const loadingBlockChildren = blockNode.loading?.children ?? [];
			const errorBlockChildren = blockNode.error?.children ?? [];

			blockChildren.push(...placeholderBlockChildren, ...loadingBlockChildren, ...errorBlockChildren);
		}

		return this.getElementsWithTranslateAttribute(blockChildren);
	}

	/**
	 * Get direct child nodes of type Text
	 * @param element
	 */
	protected getTextNodes(element: ElementLike): Text[] {
		return element.children.filter(this.isText);
	}

	/**
	 * Check if attribute is present on element
	 * @param element
	 * @param names
	 */
	protected hasAttributes(element: ElementLike, names: string[]): boolean {
		return this.getAttributes(element, names)?.length > 0 || false;
	}

	/**
	 * Get attribute value if present on element
	 * @param element
	 * @param names
	 */
	protected getAttributes(element: ElementLike, names: string[]): TextAttribute[] {
		return element.attributes.filter((attribute) => names.includes(attribute.name));
	}

	/**
	 * Check if bound attribute is present on element
	 * @param element
	 * @param names
	 */
	protected hasBoundAttributes(element: ElementLike, names: string[]): boolean {
		return this.getBoundAttributes(element, names)?.length > 0 || false;
	}

	/**
	 * Get bound attribute if present on element
	 * @param element
	 * @param names
	 */
	protected getBoundAttributes(element: ElementLike, names: string[]): BoundAttribute[] {
		return element.inputs.filter((input) => names.includes(input.name));
	}

	/**
	 * Get literal primitives from expression
	 * @param exp
	 */
	protected getLiteralPrimitives(exp: AST): LiteralPrimitive[] {
		if (exp instanceof LiteralPrimitive) {
			return [exp];
		}

		let visit: AST[] = [];
		if (exp instanceof Interpolation) {
			visit = exp.expressions;
		} else if (exp instanceof LiteralArray) {
			visit = exp.expressions;
		} else if (exp instanceof LiteralMap) {
			visit = exp.values;
		} else if (exp instanceof BindingPipe) {
			visit = [exp.exp];
		} else if (exp instanceof Conditional) {
			visit = [exp.trueExp, exp.falseExp];
		} else if (exp instanceof Binary) {
			visit = [exp.left, exp.right];
		} else if (exp instanceof ASTWithSource) {
			visit = [exp.ast];
		}

		let results: LiteralPrimitive[] = [];
		visit.forEach((child) => {
			results = [...results, ...this.getLiteralPrimitives(child)];
		});
		return results;
	}

	/**
	 * Check if node type is ElementLike
	 * @param node
	 */
	protected isElementLike(node: Node): node is ElementLike {
		return node instanceof Element || node instanceof Template;
	}

	/**
	 * Check if node type is BlockNode
	 * @param node
	 */
	protected isBlockNode(node: Node): node is BlockNode {
		return (
			node.hasOwnProperty('nameSpan') &&
			node.hasOwnProperty('sourceSpan') &&
			node.hasOwnProperty('startSourceSpan') &&
			node.hasOwnProperty('endSourceSpan')
		);
	}

	/**
	 * Check if node type is Text
	 * @param node
	 */
	protected isText(node: Node): node is Text {
		return node instanceof Text;
	}

	/**
	 * Parse a template into nodes
	 * @param template
	 * @param path
	 */
	protected parseTemplate(template: string, path: string): Node[] {
		return parseTemplate(template, path).nodes;
	}
}

import { describe, it, expect } from 'vitest';
import {
  loadTemplate,
  loadAllTemplates,
  getTemplateMetadata,
  getTemplatesByCategory,
  TEMPLATES,
  Template
} from '../../src/generation/template-registry.js';
import { functionRegistry } from '../../src/integration/function-registry.js';

describe('Template Registry', () => {
  // Verify all 14 templates are registered
  describe('Template Metadata', () => {
    it('should have exactly 14 templates registered', () => {
      expect(TEMPLATES).toHaveLength(14);
    });

    it('should have 4 markdown templates', () => {
      const mdTemplates = TEMPLATES.filter(t => t.category === 'markdown');
      expect(mdTemplates).toHaveLength(4);
    });

    it('should have 10 architecture templates', () => {
      const archTemplates = TEMPLATES.filter(t => t.category === 'architecture');
      expect(archTemplates).toHaveLength(10);
    });

    it('should have correct markdown template names', () => {
      const mdNames = TEMPLATES
        .filter(t => t.category === 'markdown')
        .map(t => t.name)
        .sort();
      expect(mdNames).toEqual([
        'agents-template',
        'gate-prd-template',
        'project-prd-template',
        'proposal-template'
      ].sort());
    });

    it('should have correct architecture template names', () => {
      const archNames = TEMPLATES
        .filter(t => t.category === 'architecture')
        .map(t => t.name)
        .sort();
      expect(archNames).toEqual([
        'system-overview-template',
        'gate-roadmap-template',
        'data-flow-template',
        'lifecycle-template',
        'component-diagram-template',
        'context-diagram-template',
        'deployment-diagram-template',
        'network-diagram-template',
        'package-diagram-template',
        'sequence-diagram-template'
      ].sort());
    });

    it('each template should have required metadata fields', () => {
      for (const template of TEMPLATES) {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('category');
        expect(template).toHaveProperty('path');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('shortName');
        
        expect(typeof template.name).toBe('string');
        expect(typeof template.category).toBe('string');
        expect(typeof template.path).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(typeof template.shortName).toBe('string');
      }
    });

    it('template paths should follow correct conventions', () => {
      for (const template of TEMPLATES) {
        if (template.category === 'markdown') {
          expect(template.path).toMatch(/^templates\/md-templates\//);
          expect(template.path).toMatch(/\.md$/);
        } else if (template.category === 'architecture') {
          expect(template.path).toMatch(/^templates\/architecture-templates\//);
          expect(template.path).toMatch(/\.md$/);
        }
      }
    });
  });

  // Test getTemplateMetadata
  describe('getTemplateMetadata()', () => {
    it('should return metadata for existing template', () => {
      const metadata = getTemplateMetadata('gate-prd-template');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('gate-prd-template');
      expect(metadata?.category).toBe('markdown');
    });

    it('should return undefined for non-existent template', () => {
      const metadata = getTemplateMetadata('non-existent-template');
      expect(metadata).toBeUndefined();
    });

    it('should return metadata for each of the 16 templates', () => {
      for (const template of TEMPLATES) {
        const metadata = getTemplateMetadata(template.name);
        expect(metadata).toEqual(template);
      }
    });
  });

  // Test getTemplatesByCategory
  describe('getTemplatesByCategory()', () => {
    it('should return 4 markdown templates', () => {
      const mdTemplates = getTemplatesByCategory('markdown');
      expect(mdTemplates).toHaveLength(4);
      for (const template of mdTemplates) {
        expect(template.category).toBe('markdown');
      }
    });

    it('should return 10 architecture templates', () => {
      const archTemplates = getTemplatesByCategory('architecture');
      expect(archTemplates).toHaveLength(10);
      for (const template of archTemplates) {
        expect(template.category).toBe('architecture');
      }
    });

    it('should return correct markdown templates', () => {
      const mdTemplates = getTemplatesByCategory('markdown');
      const names = mdTemplates.map(t => t.name).sort();
      expect(names).toContain('agents-template');
      expect(names).toContain('gate-prd-template');
      expect(names).toContain('project-prd-template');
      expect(names).toContain('proposal-template');
    });
  });

  // Test loadTemplate
  describe('loadTemplate()', () => {
    it('should load gate-prd-template successfully', async () => {
      const content = await loadTemplate('gate-prd-template');
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should load proposal-template successfully', async () => {
      const content = await loadTemplate('proposal-template');
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should load all markdown templates', async () => {
      const mdTemplates = getTemplatesByCategory('markdown');
      for (const template of mdTemplates) {
        const content = await loadTemplate(template.name);
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('should load all architecture templates', async () => {
      const archTemplates = getTemplatesByCategory('architecture');
      for (const template of archTemplates) {
        const content = await loadTemplate(template.name);
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('should throw descriptive error for non-existent template', async () => {
      await expect(loadTemplate('fake-template')).rejects.toThrow(
        'Template "fake-template" not found'
      );
    });

    it('should include available templates list in error message', async () => {
      try {
        await loadTemplate('invalid');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Available templates:');
        }
      }
    });
  });

  // Test loadAllTemplates
  describe('loadAllTemplates()', () => {
    it('should return object with all templates', async () => {
      const allTemplates = await loadAllTemplates();
      expect(Object.keys(allTemplates)).toHaveLength(14);
    });

    it('should have all template names as keys', async () => {
      const allTemplates = await loadAllTemplates();
      for (const template of TEMPLATES) {
        expect(allTemplates).toHaveProperty(template.name);
      }
    });

    it('should have non-empty string values for all templates', async () => {
      const allTemplates = await loadAllTemplates();
      for (const [name, content] of Object.entries(allTemplates)) {
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('should contain markdown template content', async () => {
      const allTemplates = await loadAllTemplates();
      expect(allTemplates['gate-prd-template']).toBeDefined();
      expect(allTemplates['proposal-template']).toBeDefined();
    });

    it('should contain architecture template content', async () => {
      const allTemplates = await loadAllTemplates();
      expect(allTemplates['system-overview-template']).toBeDefined();
      expect(allTemplates['gate-roadmap-template']).toBeDefined();
    });
  });

  // Test function registry integration
  describe('Function Registry Integration', () => {
    it('should have getTemplate function registered', () => {
      const getTemplateFn = functionRegistry.find(f => f.name === 'getTemplate');
      expect(getTemplateFn).toBeDefined();
      expect(getTemplateFn?.description).toContain('template');
    });

    it('should have loadAllTemplates function registered', () => {
      const loadAllFn = functionRegistry.find(f => f.name === 'loadAllTemplates');
      expect(loadAllFn).toBeDefined();
    });

    it('should have getTemplatesByCategory function registered', () => {
      const getCategoryFn = functionRegistry.find(f => f.name === 'getTemplatesByCategory');
      expect(getCategoryFn).toBeDefined();
    });

    it('getTemplate should have correct parameters', () => {
      const getTemplateFn = functionRegistry.find(f => f.name === 'getTemplate');
      expect(getTemplateFn?.parameters).toHaveLength(1);
      expect(getTemplateFn?.parameters[0].name).toBe('name');
      expect(getTemplateFn?.parameters[0].required).toBe(true);
    });

    it('getTemplatesByCategory should have correct parameters', () => {
      const getCategoryFn = functionRegistry.find(f => f.name === 'getTemplatesByCategory');
      expect(getCategoryFn?.parameters).toHaveLength(1);
      expect(getCategoryFn?.parameters[0].name).toBe('category');
      expect(getCategoryFn?.parameters[0].required).toBe(true);
    });

    it('loadAllTemplates should have no required parameters', () => {
      const loadAllFn = functionRegistry.find(f => f.name === 'loadAllTemplates');
      expect(loadAllFn?.parameters).toHaveLength(0);
    });

    it('template functions should have example usage', () => {
      const templateFns = functionRegistry.filter(f =>
        ['getTemplate', 'loadAllTemplates', 'getTemplatesByCategory'].includes(f.name)
      );
      for (const fn of templateFns) {
        expect(fn.examples.length).toBeGreaterThan(0);
      }
    });
  });
});

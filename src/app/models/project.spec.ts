import { describe, it, expect } from 'vitest';
import { Project } from './project';

describe('Project', () => {
  describe('constructor', () => {
    it('should create project with decimal centroid', () => {
      const project = new Project({
        _id: 'test-1',
        name: 'Test Project',
        centroid: [-122.7224, 53.8286]
      });
      
      expect(project.centroid).toEqual([-122.7224, 53.8286]);
    });

    it('should convert DMS string centroid to decimal', () => {
      const project = new Project({
        _id: 'test-2',
        name: 'Test Project DMS',
        centroid: ['122°43\'20.8"W', '53°49\'42.9"N']
      });
      
      // Expected: -122.7224... and 53.8286...
      expect(project.centroid[0]).toBeCloseTo(-122.7224, 3);
      expect(project.centroid[1]).toBeCloseTo(53.8286, 3);
    });

    it('should handle DMS without direction suffix', () => {
      const project = new Project({
        _id: 'test-3',
        name: 'Test Project',
        centroid: ['122°43\'20.8"', '53°49\'42.9"']
      });
      
      // Without direction suffix, should be positive
      expect(project.centroid[0]).toBeCloseTo(122.7224, 3);
      expect(project.centroid[1]).toBeCloseTo(53.8286, 3);
    });

    it('should handle numeric strings', () => {
      const project = new Project({
        _id: 'test-4',
        name: 'Test Project',
        centroid: ['-122.7224', '53.8286']
      });
      
      expect(project.centroid).toEqual([-122.7224, 53.8286]);
    });

    it('should handle empty centroid', () => {
      const project = new Project({
        _id: 'test-5',
        name: 'Test Project',
        centroid: []
      });
      
      expect(project.centroid).toEqual([]);
    });

    it('should handle null centroid', () => {
      const project = new Project({
        _id: 'test-6',
        name: 'Test Project',
        centroid: null
      });
      
      expect(project.centroid).toEqual([]);
    });

    it('should handle missing centroid', () => {
      const project = new Project({
        _id: 'test-7',
        name: 'Test Project'
      });
      
      expect(project.centroid).toEqual([]);
    });

    it('should reject invalid coordinate format', () => {
      const project = new Project({
        _id: 'test-8',
        name: 'Test Project',
        centroid: ['invalid', 'data']
      });
      
      // Invalid coordinates should result in empty centroid
      expect(project.centroid).toEqual([]);
    });
  });

  describe('parseCoordinate', () => {
    it('should parse decimal numbers', () => {
      expect(Project.parseCoordinate(53.8286)).toBe(53.8286);
      expect(Project.parseCoordinate(-122.7224)).toBe(-122.7224);
    });

    it('should parse numeric strings', () => {
      expect(Project.parseCoordinate('53.8286')).toBe(53.8286);
      expect(Project.parseCoordinate('-122.7224')).toBe(-122.7224);
    });

    it('should parse DMS with North direction', () => {
      const result = Project.parseCoordinate('53°49\'42.9"N');
      expect(result).toBeCloseTo(53.8286, 3);
    });

    it('should parse DMS with South direction (negative)', () => {
      const result = Project.parseCoordinate('53°49\'42.9"S');
      expect(result).toBeCloseTo(-53.8286, 3);
    });

    it('should parse DMS with West direction (negative)', () => {
      const result = Project.parseCoordinate('122°43\'20.8"W');
      expect(result).toBeCloseTo(-122.7224, 3);
    });

    it('should parse DMS with East direction', () => {
      const result = Project.parseCoordinate('122°43\'20.8"E');
      expect(result).toBeCloseTo(122.7224, 3);
    });

    it('should return null for invalid input', () => {
      expect(Project.parseCoordinate('invalid')).toBeNull();
      expect(Project.parseCoordinate(null)).toBeNull();
      expect(Project.parseCoordinate(undefined)).toBeNull();
      expect(Project.parseCoordinate(NaN)).toBeNull();
    });
  });
});

// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';

export default [
  js.configs.recommended,

  // Reglas TS (type-checked)
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.spec.json'],
        tsconfigRootDir: new URL('.', import.meta.url).pathname
      }
    },
    plugins: { '@angular-eslint': angular },
    processor: angular.processInlineTemplates, // analiza templates inline
    rules: {
      // tus reglas aquí
    }
  },

  {
    files: ['**/*.html'],
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      // reglas para templates html
    }
  }
];

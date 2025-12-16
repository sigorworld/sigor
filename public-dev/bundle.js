/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./app/main.ts":
/*!*********************!*\
  !*** ./app/main.ts ***!
  \*********************/
/***/ (() => {

eval("{\n// canvas 생성\nconst canvas = document.createElement(\"canvas\");\ncanvas.width = 512;\ncanvas.height = 512;\ndocument.body.appendChild(canvas);\n// context 가져오기\nconst ctx = canvas.getContext(\"2d\");\nif (!ctx) {\n    throw new Error(\"Canvas context를 가져올 수 없습니다.\");\n}\n// 이미지 로드\nconst img = new Image();\nimg.src =\n    \"https://sigorworld.github.io/static-sigor-assets/characters/babyping/cococalf/spritesheet.png\";\nimg.onload = () => {\n    // 전체 이미지 그대로 그리기\n    ctx.drawImage(img, 0, 0);\n};\n\n\n//# sourceURL=webpack://sigor/./app/main.ts?\n}");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./app/main.ts"]();
/******/ 	
/******/ })()
;
const swaggerJsDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PAWRENT API Documentation',
      version: '1.0.0',
      description: 'API documentation cho ứng dụng quản lý sức khỏe thú cưng PAWRENT (PetTech)',
      contact: {
        name: 'PAWRENT Team',
        email: 'support@pawrent.vn',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current Environment API'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    require('path').join(__dirname, '../docs/*.yml'),
    require('path').join(__dirname, '../docs/*.js'),
    require('path').join(__dirname, '../routes/*.js')
  ],
};

const swaggerSpecs = swaggerJsDoc(options);

module.exports = swaggerSpecs;

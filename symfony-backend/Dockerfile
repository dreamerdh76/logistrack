# ---------- build: instala dependencias Composer (cache de capas) ----------
ARG PHP_VERSION=8.3
FROM composer:2 AS build
WORKDIR /app

COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --no-dev --no-scripts --prefer-dist --no-interaction --no-progress

COPY . .
RUN composer install \
    --no-dev --prefer-dist --no-interaction --no-progress \
 && composer dump-autoload --optimize


##############################
# ---------- runtime-fpm ----------
FROM php:${PHP_VERSION}-fpm-alpine AS runtime-fpm
WORKDIR /app

# Paquetes del sistema y headers para compilar extensiones PHP
RUN apk add --no-cache \
      bash tini tzdata icu-libs libzip libpng libjpeg-turbo freetype git unzip su-exec \
      $PHPIZE_DEPS icu-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev \
  && pecl install apcu \
  && docker-php-ext-enable apcu \
  && docker-php-ext-configure gd --with-jpeg --with-freetype \
  && docker-php-ext-install -j"$(nproc)" pdo_mysql opcache intl zip gd bcmath pcntl \
  && apk del --no-network icu-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev $PHPIZE_DEPS

# Opciones recomendadas de opcache (NO duplicamos apcu)
RUN set -eux; { \
    echo "opcache.enable=1"; \
    echo "opcache.enable_cli=0"; \
    echo "opcache.validate_timestamps=0"; \
    echo "opcache.memory_consumption=256"; \
    echo "opcache.max_accelerated_files=20000"; \
  } > /usr/local/etc/php/conf.d/opcache-recommended.ini

# Copiamos Composer al runtime
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Código (incluye vendor de build; si montas /app, se sobrescribe, y no pasa nada)
COPY --from=build /app /app

# Usuario de aplicación (propietario de var/ y luego de vendor/)
RUN addgroup -S app && adduser -S -G app app \
 && mkdir -p var \
 && chown -R app:app var

# ENTRYPOINT: SIEMPRE instala dependencias antes de arrancar php-fpm
RUN printf '%s\n' \
'#!/bin/sh' \
'set -e' \
'export COMPOSER_ALLOW_SUPERUSER=1' \
'export COMPOSER_NO_INTERACTION=1' \
'export COMPOSER_MEMORY_LIMIT=-1' \
'echo ">> Running composer install (APP_ENV=${APP_ENV:-prod})"' \
'if [ "${APP_ENV:-prod}" = "dev" ]; then' \
'  composer install --prefer-dist' \
'else' \
'  composer install --prefer-dist --no-dev --optimize-autoloader' \
'fi' \
'chown -R app:app /app/vendor || true' \
'chown -R app:app /app/var || true' \
'echo ">> Composer install done"' \
'exec su-exec app:app "$@"' \
> /usr/local/bin/entrypoint-composer.sh \
 && chmod +x /usr/local/bin/entrypoint-composer.sh

ENV APP_ENV=prod APP_DEBUG=0
EXPOSE 9000

ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint-composer.sh"]
CMD ["php-fpm","-F"]


##############################
# ---------- runtime-cli ----------
FROM php:${PHP_VERSION}-cli-alpine AS runtime-cli
WORKDIR /app

RUN apk add --no-cache \
      bash tini tzdata icu-libs libzip libpng libjpeg-turbo freetype git unzip su-exec \
      $PHPIZE_DEPS icu-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev \
  && pecl install apcu \
  && docker-php-ext-enable apcu \
  && docker-php-ext-configure gd --with-jpeg --with-freetype \
  && docker-php-ext-install -j"$(nproc)" pdo_mysql opcache intl zip gd bcmath pcntl \
  && apk del --no-network icu-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev $PHPIZE_DEPS

# Habilita APCu en CLI sin duplicar la extensión
RUN echo "apc.enable_cli=1" > /usr/local/etc/php/conf.d/apcu-cli.ini

# Opciones de opcache en CLI
RUN { \
    echo "opcache.enable=1"; \
    echo "opcache.enable_cli=1"; \
    echo "opcache.validate_timestamps=0"; \
    echo "opcache.memory_consumption=256"; \
    echo "opcache.max_accelerated_files=20000"; \
  } > /usr/local/etc/php/conf.d/opcache-recommended.ini

# Composer en runtime
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Código (puede ser sobrescrito por bind mount)
COPY --from=build /app /app

# ENTRYPOINT: SIEMPRE instala dependencias antes de ejecutar el comando CLI
RUN printf '%s\n' \
'#!/bin/sh' \
'set -e' \
'export COMPOSER_ALLOW_SUPERUSER=1' \
'export COMPOSER_NO_INTERACTION=1' \
'export COMPOSER_MEMORY_LIMIT=-1' \
'echo ">> Running composer install (APP_ENV=${APP_ENV:-dev})"' \
'if [ "${APP_ENV:-dev}" = "dev" ]; then' \
'  composer install --prefer-dist' \
'else' \
'  composer install --prefer-dist --no-dev --optimize-autoloader' \
'fi' \
'chown -R app:app /app/vendor || true' \
'chown -R app:app /app/var || true' \
'echo ">> Composer install done"' \
'exec su-exec app:app "$@"' \
> /usr/local/bin/entrypoint-composer.sh \
 && chmod +x /usr/local/bin/entrypoint-composer.sh

# Usuario final: app (vía su-exec desde entrypoint)
ENV APP_ENV=dev APP_DEBUG=1
ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint-composer.sh"]
CMD ["php","bin/console","list"]

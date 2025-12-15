# Nginx Runtime Image for serving Angular 21 application

FROM artifacts.developer.gov.bc.ca/docker-remote/nginx:mainline

ENV STI_SCRIPTS_PATH=/usr/libexec/s2i

# Copy S2I scripts
COPY ./s2i/bin/ $STI_SCRIPTS_PATH/
LABEL io.openshift.s2i.scripts-url=image://$STI_SCRIPTS_PATH

# Copy nginx configuration
COPY nginx.conf.template /tmp/
COPY default.conf /etc/nginx/conf.d/

# Setup directories and permissions
RUN mkdir -p /etc/nginx/ && \
    echo "" > /etc/nginx/publicServerEnvironmentSettings.js && \
    mkdir -p /tmp/app/dist/ && \
    ln -sf /etc/nginx/publicServerEnvironmentSettings.js /tmp/app/dist/publicServerEnvironmentSettings.js

# Fix up permissions for OpenShift
# ref: https://torstenwalter.de/openshift/nginx/2017/08/04/nginx-on-openshift.html
RUN chmod -R g+rwx $STI_SCRIPTS_PATH && \
    chmod g+rw /var/cache/nginx \
               /var/run \
               /var/log/nginx \
               /etc/nginx/publicServerEnvironmentSettings.js \
               /etc/nginx/nginx.conf \
               /tmp && \
    chmod 777 /run

EXPOSE 8080
USER 104

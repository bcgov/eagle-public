FROM nginx:mainline

ENV STI_SCRIPTS_PATH=/usr/libexec/s2i

COPY ./s2i/bin/ /usr/libexec/s2i/
LABEL io.openshift.s2i.scripts-url=image:///usr/libexec/s2i
COPY nginx.conf.template /tmp/
COPY default.conf /etc/nginx/conf.d/
RUN mkdir -p /etc/nginx/
RUN echo "" > /etc/nginx/publicServerEnvironmentSettings.js
RUN mkdir -p /tmp/app/dist/
RUN ln -sf /etc/nginx/publicServerEnvironmentSettings.js /tmp/app/dist/publicServerEnvironmentSettings.js
# =================================================================================
# Fix up permissions
# ref: https://torstenwalter.de/openshift/nginx/2017/08/04/nginx-on-openshift.html
# - S2I sripts must be executable
# - Make sure nginx can read and write it's working directories.
# - The container dynamically configures nginx on startup
# - The application artifacts live in /tmp
# ---------------------------------------------------------------------------------
RUN chmod -R g+rwx $STI_SCRIPTS_PATH
RUN chmod g+rw /var/cache/nginx \ 
               /var/run \
               /var/log/nginx \
               /etc/nginx/nginx.conf \
               /tmp
# =================================================================================
RUN chmod 777 /run
EXPOSE 8080
USER 104

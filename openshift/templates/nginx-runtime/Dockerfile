FROM nginx:mainline
COPY ./s2i/bin/ /usr/libexec/s2i/
LABEL io.openshift.s2i.scripts-url=image:///usr/libexec/s2i
COPY nginx.conf.template /tmp/
COPY default.conf /etc/nginx/conf.d/
RUN mkdir -p /etc/nginx/
RUN echo "" > /etc/nginx/publicServerEnvironmentSettings.js
RUN mkdir -p /tmp/app/dist/
RUN ln -sf /etc/nginx/publicServerEnvironmentSettings.js /tmp/app/dist/publicServerEnvironmentSettings.js
RUN chmod -R 0777 /tmp /var /run /etc /mnt /usr/libexec/s2i/
EXPOSE 8080
USER 104

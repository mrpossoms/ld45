g.web = {
	_draw: function() {},
	_on_message: function() {},
	_canvas: null,

    gfx: {
        _initalize: function()
        {
            with (g.web)
            {
                if (_canvas == null)
                {
                    console.error('Canvas element has not been set, WebGL cannot initialize');
                    return false;
                }

                const gl = _canvas.getContext('webgl');

                if (gl == null)
                {
                    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
                    return false;
                }

                gl.clearColor(0.1, 0.1, 0.1, 1.0);
                gl.clearDepth(1.0);                 // Clear everything
                gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
                gl.enable(gl.DEPTH_TEST);           // Enable depth testing
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                window.gl = gl;

                document.body.onresize();

                return true;
            }
        },
        camera: function() {
            this._view = [].I(4);
            this._proj = [].I(4);
            this._pos = [0,0,0];
            this._forward = [0,0,1];
            this._up = [0,1,0];

            this.look_at = function(position, subject, up)
            {
                if (position && subject && up)
                {
                    this._pos = position;
                    this._forward = position.sub(subject).norm();
                    this._up = up.norm();
                    this._view = [].view(this._pos, this._forward, this._up);
                }

                return this._view;
            };

            this.view = function(position, forward, up)
            {
                if (position && forward && up)
                {
                    this._pos = position;
                    this._forward = forward.norm();
                    this._up = up.norm();
                    this._view = [].view(this._pos, this._forward, this._up);
                }

                return this._view;
            };

            this.position = function(p)
            {
                this._pos = p;
                this.view(this._pos, this._sub, this._up);
                return this;
            };

            this.projection = function() { return this._proj; }

            this.perspective = function(fov, near, far)
            {
                fov = fov || Math.PI / 2;
                near = near || 0.1;
                far = far || 100;

                this._proj = [].perspective(fov, g.web.gfx.aspect(), near, far);

                return this;
            };

            this.orthographic = function(near, far)
            {
                const a = g.web.gfx.aspect();
                near = near || 0.1;
                far = far || 100;
                this._proj = [].orthographic(-a, a, -1, 1, near, far);

                return this;
            };
        },
        width: function() { return g.web._canvas.width; },
        height: function() { return g.web._canvas.height; },
        aspect: function()
        {
            return g.web._canvas.width / g.web._canvas.height;
        },
        texture: {
            _filtering: null,
            _wraping: null,

            repeating: function() { this._wraping = gl.REPEAT; return this; },
            clamped: function() { this._wraping = gl.CLAMP; return this; },
            pixelated: function() { this._filtering = gl.NEAREST; return this; },
            smooth: function() { this._filtering = gl.LINEAR; return this; },

            create: function(img)
            {
                const tex = gl.createTexture();

                const wrap = g.web.gfx.texture._wraping;
                const filter = g.web.gfx.texture._filtering;

                img.onload = function()
                {
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        gl.RGBA,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        img
                    );

                    if (wrap == null)
                    { console.error('Texture wrap not specified. Please call repeating() or clamped()'); }
                    if (filter == null)
                    { console.error('Texture filter not specified. Please call pixelated() or smooth()'); }

                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
                };

                return tex;
            }
        },
        shader: {
            create: function(name, vertex_src, fragment_src)
            {
                function load_shader(type, source)
                {
                    const shader = gl.createShader(type);

                    // Send the source to the shader object
                    gl.shaderSource(shader, source);

                    // Compile the shader program
                    gl.compileShader(shader);

                    // See if it compiled successfully
                    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                    {
                        console.error('Error building ' + type);
                        console.error(source);
                        console.error('An error occurred compiling the shader: ' + gl.getShaderInfoLog(shader));
                        console.error('-------------------------');

                        gl.deleteShader(shader);
                        return null;
                    }

                    return shader;
                }

                const vertex_shader = load_shader(gl.VERTEX_SHADER, vertex_src);
                const fragment_shader = load_shader(gl.FRAGMENT_SHADER, fragment_src);

                const program = gl.createProgram();
                gl.attachShader(program, vertex_shader);
                gl.attachShader(program, fragment_shader);
                gl.linkProgram(program);

                if (!gl.getProgramParameter(program, gl.LINK_STATUS))
                {
                    console.error('Failed to link shader program: ' + gl.getProgramInfoLog(program));
                    return null;
                }

                return g.web.gfx.shader[name] = program;
            }
        },
        mesh: {
            create: function(mesh_json)
            {
                var mesh = {
                    indices: null,
                    vertices: {},
                    shader_configs: {},

                    using_shader: function(shader_name)
                    {
                        const mesh_ref = this;
                        const shader = g.web.gfx.shader[shader_name];
                        var tex_unit = 0;
                        gl.useProgram(shader);

                        return {
                            with_attribute: function(description)
                            {
                                // TODO: add functionality to cache vertex attr pointers
                                const buf = mesh_ref.vertices[description.buffer];

                                if (buf === undefined) { console.error('Cannot use undefined buffer'); return; }
                                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                                const loc = gl.getAttribLocation(shader, description.name);
                                if (loc < 0)
                                {
                                    console.error('Cannot find location for attribute "' + name + '" in shader "' + shader_name + '"');
                                    return null;
                                }

                                gl.vertexAttribPointer(
                                    loc,
                                    description.components || 1,
                                    description.type || gl.FLOAT,
                                    description.normalized || false,
                                    description.stride || 0,
                                    description.offset || 0
                                );
                                gl.enableVertexAttribArray(loc);

                                return this;
                            },
                            with_camera: function(camera)
                            {
                                return this.set_uniform('u_proj').mat4(camera.projection())
                                           .set_uniform('u_view').mat4(camera.view());
                            },
                            set_uniform: function(uni_name)
                            {
                                const shader_ref = this;
                                const loc = gl.getUniformLocation(shader, uni_name);

                                if (loc < 0) { console.error('Could not find uniform "' + uni_name + '"'); }

                                return {
                                    mat4: function(m)
                                    {
                                        const v = m.as_Float32Array();
                                        gl.uniformMatrix4fv(loc, false, v);
                                        return shader_ref;
                                    },
                                    texture: function(tex)
                                    {
                                        gl.activeTexture(gl.TEXTURE0 + tex_unit);
                                        gl.bindTexture(gl.TEXTURE_2D, tex);
                                        gl.uniform1i(loc, tex_unit);
                                        ++tex_unit;
                                        return shader_ref;
                                    },
                                };
                            },
                            draw_tris: function()
                            {
                                if (mesh_ref.indices)
                                {
                                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh_ref.indices);
                                    gl.drawElements(
                                        gl.TRIANGLES,
                                        mesh_ref.element_count,
                                        gl.UNSIGNED_SHORT,
                                        0
                                    );
                                }
                                else
                                {
                                    gl.drawArrays(gl.TRIANGLES, 0, mesh_ref.positions.length);
                                }
                            }
                        };
                    }
                };

                if (mesh_json.positions)
                {
                    mesh.vertices.positions = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices.positions);
                    gl.bufferData(gl.ARRAY_BUFFER, mesh_json.positions.as_Float32Array(), gl.STATIC_DRAW);
                }

                if (mesh_json.texture_coords)
                {
                    mesh.vertices.texture_coords = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices.texture_coords);
                    gl.bufferData(gl.ARRAY_BUFFER, mesh_json.texture_coords.as_Float32Array(), gl.STATIC_DRAW);
                }

                if (mesh_json.normals)
                {
                    mesh.vertices.normals = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices.normals);
                    gl.bufferData(gl.ARRAY_BUFFER, mesh_json.normals.as_Float32Array(), gl.STATIC_DRAW);
                }

                if (mesh_json.indices)
                {
                    mesh.indices = gl.createBuffer();
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh_json.indices.as_Int16Array(), gl.STATIC_DRAW);
                    mesh.element_count = mesh_json.indices.length;
                }
                else
                {
                    mesh.element_count = mesh_json.positions.length;
                }

                return mesh;
            }
        }
    },

	assets: {
		load: function(asset_arr, on_finish)
		{
			var count = asset_arr.length;

            function load_resource(path)
            {
                return fetch(path).then(function(res)
                {
                    const type = res.headers.get('content-type');
                    const type_stem = type.split('/')[0];
                    var bytes_to_read = parseInt(res.headers.get('content-length'));

                    switch (type_stem)
                    {
                        case 'image':
                        {
                            var img = new Image();
                            img.src = res.url;
                            g.web.assets[path] = img;
                        } break;

                        case 'audio':
                        {
                            g.web.assets[path] = new Audio(res.url);
                        } break;
                    }

                    // specific mime types
                    switch (type)
                    {
                        case 'application/json':
                        case 'application/json; charset=UTF-8':
                        {
                            g.web.assets[path] = '';
                            return res.body.getReader().read().then(function(res)
                            {
                                g.web.assets[path] += (new TextDecoder()).decode(res.value);
                                bytes_to_read -= res.value.length;
                                if (res.done || bytes_to_read == 0)
                                {
                                    g.web.assets[path] = JSON.parse(g.web.assets[path]);
                                }
                            });
                        } break;

                        case 'text/plain':
                        case 'application/octet-stream':
                        {
                            g.web.assets[path] = '';
                            return res.body.getReader().read().then(function(res)
                            {
                                g.web.assets[path] += (new TextDecoder()).decode(res.value);
                            });
                        } break;
                    }
                });
            }

            var promises = [];
	for (var i = 0; i < asset_arr.length; i++)
	{
		promises.push(load_resource(asset_arr[i]));
	}

            Promise.all(promises).then(function(values)
            {
                on_finish();
            });
		},
	},

	pointer:
	{
        _last : [ 0, 0 ],

		on_move: function(on_move_func)
		{
			g.web._canvas.addEventListener("touchmove", function(e)
			{
				e.preventDefault();
                g.web.pointer._last = [0, 0];
				on_move_func({ x: 0, y: 0 });
			}, false);

			g.web._canvas.addEventListener("mousemove", function(e)
			{
				e.preventDefault();
                g.web.pointer._last = [ e.clientX, e.clientY ];
				on_move_func(e);
			}, false);

			return this;
		},

        on_delta: function(on_delta_func)
        {
            if ("onpointerlockchange" in document)
            {
                document.addEventListener('pointerlockchange', function(e)
                {
                    on_delta_func(e);
                }, false);
            }
            else if ("onmozpointerlockchange" in document)
            {
                document.addEventListener('mozpointerlockchange', function(e)
                {
                    on_delta_func(e);
                }, false);
            }
        },

        cast_ray: function(view)
        {
            const s = [ g.web.gfx.width(), g.web.gfx.height() ];
            const h = s.mul(0.5);
            const p = g.web.pointer._last.sub(h).div(h);
            const d = [ p[0], p[1], 1, 1 ];

            const dp = view.mat_mul(d);

            // console.log(dp);
        },

		on_press: function(on_press_func)
		{
			return this;
		}
	},

	key:
	{
		_initalized: false,
		_map: {},
		is_pressed: function(key)
		{

			if (!g.web.key._initalized)
			{
				document.onkeydown = function(key)
				{
					g.web.key._map[key.key] = true;
				};

				document.onkeyup = function(key)
				{
					g.web.key._map[key.key] = false;
				};

				g.web.key._initalized = true;
			}

			return g.web.key._map[key] || false;
		}
	},

	on_message: function(f) { g.web._on_message = f; return this; },

	canvas: function(dom_element)
	{
		g.web._canvas = dom_element;
		document.body.onresize = function(e) {
			g.web._canvas.width = document.body.clientWidth;
			g.web._canvas.height = document.body.clientHeight;
            gl.viewport(0, 0, document.body.clientWidth, document.body.clientHeight);
		};

        g.web._canvas.requestPointerLock = g.web._canvas.requestPointerLock ||
                                           g.web._canvas.mozRequestPointerLock;

        document.exitPointerLock = document.exitPointerLock ||
                                   document.mozExitPointerLock;

        g.web._canvas.requestPointerLock();

		return this;
	},

	draw: function(f) { g.web._draw = f; return this; }

};

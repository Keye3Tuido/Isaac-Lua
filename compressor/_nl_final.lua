function MakePixel()
    local _sprite, _size, _scale, _color, pixel, fix = Sprite(), Vector(1/784, 1/448), Vector(1, 1), Color(1,1,1), {}
    _sprite:Load('gfx/ui/stage/nightmare_bg.anm2', true)
    _sprite:SetFrame('Intro', 0)
    _sprite.Scale = _size
    _sprite.Color = Color(1,1,1,1,1,1,1)

    fix = function()
        _sprite.Offset = Vector.FromAngle(_sprite.Rotation - 90) * (15 * _sprite.Scale.Y)
    end
    fix()

    setmetatable(pixel, {
        __index = function(self, key)
            if key == 'Scale' then
                return _scale
            elseif key == 'Color' then
                return _color
			elseif key == 'Rotation' then
				return _sprite.Rotation
            elseif key == 'Render' then
                return function(_, position)
                    _sprite:RenderLayer(0, position)
                end
            end
        end,
        __newindex = function(self, key, value)
			if key == 'Scale' then
				_scale = value
				_sprite.Scale = value * _size
			elseif key == 'Color' then
				_color = value
				_sprite.Color = Color(1, 1, 1, value.A, value.R+value.RO, value.G+value.GO, value.B+value.BO)
            elseif key == 'Rotation' then
				_sprite.Rotation = value
                fix()
			end
		end
    })
    return pixel
end

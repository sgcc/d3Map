/**
 * Created by zhanghaishun on 2017/6/16.
 *
 */

var Psdb = window.Psdb = Psdb || {};

(function(){
    "use strict";

    var Contour = function (context,width,height) {

        this.mode = {
            mapType         :"contour"  ,//等高线图类型 [heatmap,contour]
            heatmap_line    :false      ,//热图-是否显示登高线条
            contour_isfull  :false      ,//登高线条-是否填充

            drawpoint       :false      ,//热图-是否显示登高线条
            drawlable       :false      ,//登高线条-是否填充

            isCustomColor   :false       ,//自定义颜色
            referenceValue  :0.9        ,//等高线参考电压标幺值
            mapAlpha        :0.4        ,//透明
            mapThresholds   :10          //等高线密度
        };

        this.context        = context; //canvas 根节点
        this.width          = width;   //等高线全局宽
        this.height         = height;  //等高线全局高
        this.contours       = d3.contours().size([width, height]); //等高线绘图实例
        this.d3Color = d3.scaleLinear().domain([1,10]).range(["green", "red"]);
        this.d3Path         = d3.geoPath(null, context);  //绘图笔

        this.mapData        =[];       //原始数据
        this.imapData       =[];       //插值后数据
        this.newData        =[];       //规整后数据

        this.heatMapImage   = context.createImageData(width, height);     //等高线图片
    };
    var p= Contour.prototype;

　　/*
     初始化等高线图
     mode：图形设置
     data：原始采样点
     */
    p.initMap = function (mode,data) {
        let me = this;

        me.mapData = data;
        me.initData();
        me.refreshMap(mode);
    };
    /*
     根据设置刷新等高线图
     mode：地图设置
     */
    p.refreshMap = function (modeSet) {
        var me = this;

        //新配置覆盖默认配置
        me.appMapSet(modeSet);

        //应用参考电压值
        if(me.mode.referenceValue){
            me.makeData();
        };

        //清屏
        context.clearRect(0,0,width,height);

        //绘制热图
        if(me.mode.mapType === "heatmap"){
            me.drawHeatMap();
        };

        //绘制等高线图
        if(me.mode.mapType ==="contour" || me.mode.heatmap_line ){
            me.drawContour();
        };

        //绘制测试点
        if(me.mode.drawpoint){
            me.drawPoint();
        };

        //绘制标签
        if(me.mode.drawlable){
            me.drawLable();
        };


    };

    /*
        应用页面设置到控件设置
     */
    p.appMapSet = function(mapSet){
        var me = this;

        for(var ms in mapSet ){
            me.mode[ms] = mapSet[ms];
        };

    };

    /*
    离散点插值
     */
    p.initData = function(){
        var s = new Date().getTime();
        this.imapData = this.idw(this.mapData,this.width,this.height);
        var e = new Date().getTime();
        console.log('插值：'+(e-s)/1000+'秒');
    };

    /*
    通过参考值规整插值后数据
     */
    p.makeData = function(){
        for(var i =0;i<this.imapData.length;i++){
            this.newData[i] = this.imapData[i] - this.mode.referenceValue;
        };
    };

    /*
    绘制测试点标签
     */
    p.drawLable = function () {
        var me = this;
        me.mapData.forEach(function (d) {
            me.context.beginPath();
            me.context.font = "10px Courier New";  //设置字体样式
            me.context.strokeStyle = "black"; //设置字体颜色
            me.context.strokeText(d.value.toFixed(3), d.x, d.y); //从坐标点(50,50)开始绘制文字
        });
    };

    /*
    绘制测试点
     */
    p.drawPoint = function () {
        var me = this;
        me.mapData.forEach(function (d) {
            me.context.beginPath();
            me.context.arc(d.x, d.y, 1.5, 0, Math.PI *2 , false);
            me.context.fillStyle = 'red';
            me.context.fill();
            me.context.stroke();
        });

    };

    p.drawHeatMap = function () {
        var me = this;

        var mapAlpha = Math.round(255*mode.mapAlpha);
        for (var j = 0,k = 0, l = 0;j < width; ++j) {
                for (var i = 0; i < height; ++i,++k, l += 4) {
                    var c = me.getColor(me.newData[k]);
                    me.heatMapImage.data[l + 0] = c.r;
                    me.heatMapImage.data[l + 1] = c.g;
                    me.heatMapImage.data[l + 2] = c.b;
                    me.heatMapImage.data[l + 3] = mapAlpha;
                }
            }
        context.putImageData(me.heatMapImage, 0, 0);
    };



    /*
        绘制等高线图
        todo：等高线上显示数值大小
     */
    p.drawContour = function(){
        var me = this;
        var context = me.context;

        context.globalAlpha = mode.mapAlpha; //设置透明度
        context.lineWidth = 1; //线条宽度

        //绘图登高线图
        me.contours
            .thresholds(me.mode.mapThresholds)
            (me.newData)
            .forEach(fill);

        //绘图一条等高线
        function fill(geometry) {
            context.beginPath();
            me.d3Path(geometry);
            var acolor = me.getColor(geometry.value);

            //等高线梯度着色
            if(me.mode.contour_isfull){
                context.fillStyle = acolor ;
                context.fill();
            }

            //等高线线条
            if(me.mode.mapType ==="contour" || me.mode.heatmap_line){
                context.strokeStyle = acolor;
                context.stroke();
            }
        }

    };

    /*
      idw 基本插值算法，没有优化，提升空间还很多
     todo：现在是每个像素一个值，可以选择一个矩形为一个像素
     todo：影响范围：相距一段距离后，不参与计算
     */
    p.idw = function(data){
        var d = data;
        var width = this.width;
        var height = this.height;

        //已有点初始二维数组
        var dlen = d.length;
        var matrixData = new Array(width * height);
        for(var i = 0; i < dlen; i++) {
            var point  = d[i];
            matrixData[point.y * width +point.x] = point.value;
        }

        /**
         * 插值矩阵数据,时间复杂度O(height*width*len)
         * 当height = 356, width = 673, len = 26时为6229288
         */
        for(var i = 0,k1=0; i < height  ; i++) {
            for(var j = 0; j <width ; j++,k1++) {
                if(!matrixData[k1]) {
                    var sum0 = 0, sum1 = 0;
                    for(var k = 0; k < dlen; k++) {
                        var dk = d[k];
                        if((i-dk.y)<850 && (j-dk.x)<850 ){
                            var dis = ((i-dk.y)*(i-dk.y) + (j-dk.x)*(j-dk.x));
                            sum0 =   sum0 +  dk.value*1/dis;
                            sum1 = sum1 +    1/dis;
                        }
                    }
                    if(sum1 != 0)
                        matrixData[k1] = sum0/sum1;
                    else
                        matrixData[k1] = 1;
                }
            }
        }

        return matrixData;
    };

    p.getColor = function (fThisValue) {
        var me = this;
        if(me.mode.isCustomColor){
            var rgb = me.getRGB(fThisValue);
            return d3.rgb(rgb[0], rgb[1], rgb[2]);
        }else {
            return d3.rgb(me.d3Color(fThisValue));
        };

    };

    p.getRGB = function(fThisValue) {
        var  fThisR = 0;
        var  fThisG = 0;
        var  fThisB = 0;

        if (fThisValue < -0.2)
        {
            fThisR = 0;
            fThisG = 0;
            fThisB = 0.5;
        }
        else if (fThisValue < -0.15)
        {
            fThisR = 0;
            fThisG = 0;
            fThisB = 10 * (fThisValue + 0.25);
        }
        else if (fThisValue < -0.05)
        {
            fThisR = 0;
            fThisG = 10 * (fThisValue + 0.15);
            fThisB = 1.0;
        }
        else if (fThisValue < 0.05)
        {
            fThisR = 10 * (fThisValue + 0.05);
            fThisG = 1.0;
            fThisB = -10 * (fThisValue - 0.05);
        }
        else if (fThisValue < 0.15)
        {
            fThisR = 1.0;
            fThisG = -10 * (fThisValue - 0.15);
            fThisB = 0;
        }
        else if (fThisValue < 0.2)
        {
            fThisR = -10 * (fThisValue - 0.25);
            fThisG = 0;
            fThisB = 0;
        }
        else
        {
            fThisR = 0.5;
            fThisG = 0;
            fThisB = 0;
        }

        var colorV =[];
        colorV[0] = Math.round(fThisR * 255);
        colorV[1] = Math.round(fThisG * 255);
        colorV[2] = Math.round(fThisB * 255);
        return colorV;
    };

    Psdb.Contour = Contour;
}());